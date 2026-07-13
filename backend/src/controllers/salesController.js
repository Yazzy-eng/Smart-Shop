const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

function generateInvoiceNumber() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `INV-${stamp}-${rand}`;
}

// GET /api/sales?from=&to=&cashierId=&customerId=&limit=
async function listSales(req, res) {
  const { from, to, cashierId, customerId, limit } = req.query;
  const conditions = [];
  const params = [];

  if (from) { params.push(from); conditions.push(`s.created_at >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`s.created_at <= $${params.length}`); }
  if (cashierId) { params.push(cashierId); conditions.push(`s.cashier_id = $${params.length}`); }
  if (customerId) { params.push(customerId); conditions.push(`s.customer_id = $${params.length}`); }

  if (req.user.role_name === 'cashier') {
    params.push(req.user.id);
    conditions.push(`s.cashier_id = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(parseInt(limit, 10) || 50, 200));

  const { rows } = await db.query(
    `SELECT s.*, u.full_name AS cashier_name, c.name AS customer_name
     FROM sales s
     JOIN users u ON u.id = s.cashier_id
     LEFT JOIN customers c ON c.id = s.customer_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  res.json({ sales: rows });
}

// GET /api/sales/:id  (full receipt detail)
async function getSale(req, res) {
  const { id } = req.params;

  const { rows: saleRows } = await db.query(
    `SELECT s.*, u.full_name AS cashier_name, c.name AS customer_name, c.phone AS customer_phone
     FROM sales s
     JOIN users u ON u.id = s.cashier_id
     LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.id = $1`,
    [id]
  );
  if (saleRows.length === 0) return res.status(404).json({ error: 'Sale not found.' });

  const { rows: items } = await db.query(
    `SELECT si.*, p.name AS product_name, p.unit
     FROM sale_items si JOIN products p ON p.id = si.product_id
     WHERE si.sale_id = $1`,
    [id]
  );

  const { rows: payments } = await db.query(`SELECT * FROM payments WHERE sale_id = $1`, [id]);

  res.json({ sale: saleRows[0], items, payments });
}

// POST /api/sales  -- the checkout transaction
async function createSale(req, res) {
  const {
    customerId,
    walkinCustomerName,
    items,
    discountUsd = 0,
    taxUsd = 0,
    saleCurrency = 'USD',
    isOnAccount = false,
    payments = [],
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: rateRows } = await client.query(
      `SELECT rate FROM exchange_rates WHERE is_active = true ORDER BY created_at DESC LIMIT 1`
    );
    if (rateRows.length === 0) {
      throw Object.assign(new Error('No exchange rate configured. Set one in Settings first.'), { status: 400 });
    }
    const exchangeRate = Number(rateRows[0].rate);

    if (isOnAccount) {
      if (!customerId) throw Object.assign(new Error('An account customer is required for on-account sales.'), { status: 400 });
      const { rows: custRows } = await client.query(
        `SELECT customer_type, credit_limit_usd FROM customers WHERE id = $1 FOR UPDATE`,
        [customerId]
      );
      if (custRows.length === 0) throw Object.assign(new Error('Customer not found.'), { status: 404 });
      if (!['monthly_account', 'walkin'].includes(custRows[0].customer_type)) {
        throw Object.assign(new Error('This customer type cannot purchase on account.'), { status: 400 });
      }
    }

    let subtotalUsd = 0;
    const lineData = [];
    for (const item of items) {
      const { rows: prodRows } = await client.query(
        `SELECT id, name, sell_price_usd, quantity_on_hand FROM products WHERE id = $1 FOR UPDATE`,
        [item.productId]
      );
      if (prodRows.length === 0) {
        throw Object.assign(new Error(`Product not found: ${item.productId}`), { status: 404 });
      }
      const product = prodRows[0];
      const qty = Number(item.quantity);
      if (!qty || qty <= 0) {
        throw Object.assign(new Error(`Invalid quantity for ${product.name}.`), { status: 400 });
      }
      if (Number(product.quantity_on_hand) < qty) {
        throw Object.assign(new Error(`Not enough stock for ${product.name}. Available: ${product.quantity_on_hand}`), { status: 400 });
      }

      const unitPrice = item.unitPriceUsd !== undefined ? Number(item.unitPriceUsd) : Number(product.sell_price_usd);
      const lineDiscount = Number(item.discountUsd || 0);
      const lineTotal = (unitPrice * qty) - lineDiscount;

      subtotalUsd += unitPrice * qty;
      lineData.push({ productId: product.id, qty, unitPrice, lineDiscount, lineTotal, productName: product.name });
    }

    const totalUsd = subtotalUsd - Number(discountUsd) + Number(taxUsd);
    if (totalUsd < 0) {
      throw Object.assign(new Error('Total cannot be negative.'), { status: 400 });
    }

    if (!isOnAccount) {
      const paid = payments.reduce((sum, p) => sum + Number(p.amountUsd || 0), 0);
      if (Math.abs(paid - totalUsd) > 0.01) {
        throw Object.assign(new Error(`Payment total (${paid.toFixed(2)}) does not match sale total (${totalUsd.toFixed(2)}).`), { status: 400 });
      }
    }

    const invoiceNumber = generateInvoiceNumber();

    const { rows: saleRows } = await client.query(
      `INSERT INTO sales
        (invoice_number, customer_id, cashier_id, sale_currency, exchange_rate_used,
         subtotal_usd, discount_usd, tax_usd, total_usd, is_on_account, status, walkin_customer_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'completed',$11)
       RETURNING *`,
      [invoiceNumber, customerId || null, req.user.id, saleCurrency, exchangeRate,
       subtotalUsd, discountUsd, taxUsd, totalUsd, isOnAccount, customerId ? null : (walkinCustomerName || null)]
    );
    const sale = saleRows[0];

    for (const line of lineData) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price_usd, discount_usd, line_total_usd)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [sale.id, line.productId, line.qty, line.unitPrice, line.lineDiscount, line.lineTotal]
      );

      await client.query(
        `UPDATE products SET quantity_on_hand = quantity_on_hand - $1, updated_at = now() WHERE id = $2`,
        [line.qty, line.productId]
      );

      await client.query(
        `INSERT INTO inventory_transactions (product_id, type, quantity, reference_type, reference_id, performed_by)
         VALUES ($1, 'sale_out', $2, 'sale', $3, $4)`,
        [line.productId, -line.qty, sale.id, req.user.id]
      );
    }

    for (const p of payments) {
      await client.query(
        `INSERT INTO payments (sale_id, customer_id, method, currency, amount_usd, reference_note, received_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [sale.id, null, p.method, p.currency || 'USD', p.amountUsd, p.referenceNote || null, req.user.id]
      );
    }

    await client.query('COMMIT');

    await logActivity({
      userId: req.user.id,
      action: 'SALE_CREATED',
      entityType: 'sale',
      entityId: sale.id,
      details: { invoiceNumber, totalUsd, isOnAccount, itemCount: lineData.length },
      ipAddress: req.ip,
    });

    res.status(201).json({
      sale,
      items: lineData,
      exchangeRate,
      totalSos: totalUsd * exchangeRate,
      walkinCustomerName: customerId ? null : (walkinCustomerName || null),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.status || 500;
    if (status === 500) console.error('Create sale error:', err);
    res.status(status).json({ error: err.message || 'Server error creating sale.' });
  } finally {
    client.release();
  }
}

// POST /api/sales/:id/void  (admin/manager only, restores stock)
async function voidSale(req, res) {
  const { id } = req.params;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: saleRows } = await client.query(`SELECT * FROM sales WHERE id = $1 FOR UPDATE`, [id]);
    if (saleRows.length === 0) throw Object.assign(new Error('Sale not found.'), { status: 404 });
    if (saleRows[0].status === 'voided') throw Object.assign(new Error('Sale is already voided.'), { status: 400 });

    const { rows: items } = await client.query(`SELECT * FROM sale_items WHERE sale_id = $1`, [id]);
    for (const item of items) {
      await client.query(
        `UPDATE products SET quantity_on_hand = quantity_on_hand + $1, updated_at = now() WHERE id = $2`,
        [item.quantity, item.product_id]
      );
      await client.query(
        `INSERT INTO inventory_transactions (product_id, type, quantity, reference_type, reference_id, performed_by, notes)
         VALUES ($1, 'adjustment', $2, 'sale_void', $3, $4, 'Stock restored from voided sale')`,
        [item.product_id, item.quantity, id, req.user.id]
      );
    }

    await client.query(`UPDATE sales SET status = 'voided' WHERE id = $1`, [id]);
    await client.query('COMMIT');

    await logActivity({
      userId: req.user.id, action: 'SALE_VOIDED', entityType: 'sale',
      entityId: id, ipAddress: req.ip,
    });

    res.json({ message: 'Sale voided and stock restored.' });
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.status || 500;
    if (status === 500) console.error('Void sale error:', err);
    res.status(status).json({ error: err.message || 'Server error voiding sale.' });
  } finally {
    client.release();
  }
}

module.exports = { listSales, getSale, createSale, voidSale };
