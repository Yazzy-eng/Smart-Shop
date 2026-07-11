const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

function generatePoNumber() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `PO-${stamp}-${rand}`;
}

// GET /api/purchase-orders?status=
async function listPurchaseOrders(req, res) {
  const { status } = req.query;
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`po.status = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT po.*, s.name AS supplier_name, u.full_name AS ordered_by_name
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN users u ON u.id = po.ordered_by
     ${where}
     ORDER BY po.ordered_at DESC
     LIMIT 100`,
    params
  );
  res.json({ purchaseOrders: rows });
}

// GET /api/purchase-orders/:id
async function getPurchaseOrder(req, res) {
  const { id } = req.params;
  const { rows: poRows } = await db.query(
    `SELECT po.*, s.name AS supplier_name FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = $1`,
    [id]
  );
  if (poRows.length === 0) return res.status(404).json({ error: 'Purchase order not found.' });

  const { rows: items } = await db.query(
    `SELECT poi.*, p.name AS product_name
     FROM purchase_order_items poi JOIN products p ON p.id = poi.product_id
     WHERE poi.purchase_order_id = $1`,
    [id]
  );

  res.json({ purchaseOrder: poRows[0], items });
}

// POST /api/purchase-orders  { supplierId, notes, items: [{ productId, quantity, unitCostUsd }] }
async function createPurchaseOrder(req, res) {
  const { supplierId, notes, items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const poNumber = generatePoNumber();
    const { rows: poRows } = await client.query(
      `INSERT INTO purchase_orders (po_number, supplier_id, status, ordered_by, notes)
       VALUES ($1,$2,'pending',$3,$4) RETURNING *`,
      [poNumber, supplierId || null, req.user.id, notes || null]
    );
    const po = poRows[0];

    for (const item of items) {
      if (!item.productId || !item.quantity || !item.unitCostUsd) {
        throw Object.assign(new Error('Each item needs productId, quantity, and unitCostUsd.'), { status: 400 });
      }
      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost_usd)
         VALUES ($1,$2,$3,$4)`,
        [po.id, item.productId, item.quantity, item.unitCostUsd]
      );
    }

    await client.query('COMMIT');

    await logActivity({
      userId: req.user.id, action: 'PURCHASE_ORDER_CREATED', entityType: 'purchase_order',
      entityId: po.id, details: { poNumber, itemCount: items.length }, ipAddress: req.ip,
    });

    res.status(201).json({ purchaseOrder: po });
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.status || 500;
    if (status === 500) console.error('Create PO error:', err);
    res.status(status).json({ error: err.message || 'Server error creating purchase order.' });
  } finally {
    client.release();
  }
}

// POST /api/purchase-orders/:id/receive
async function receivePurchaseOrder(req, res) {
  const { id } = req.params;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: poRows } = await client.query(`SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE`, [id]);
    if (poRows.length === 0) throw Object.assign(new Error('Purchase order not found.'), { status: 404 });
    if (poRows[0].status === 'received') throw Object.assign(new Error('This purchase order was already received.'), { status: 400 });
    if (poRows[0].status === 'cancelled') throw Object.assign(new Error('This purchase order was cancelled.'), { status: 400 });

    const { rows: items } = await client.query(`SELECT * FROM purchase_order_items WHERE purchase_order_id = $1`, [id]);

    for (const item of items) {
      await client.query(
        `UPDATE products SET quantity_on_hand = quantity_on_hand + $1, cost_price_usd = $2, updated_at = now() WHERE id = $3`,
        [item.quantity, item.unit_cost_usd, item.product_id]
      );
      await client.query(
        `INSERT INTO inventory_transactions (product_id, type, quantity, reference_type, reference_id, performed_by, notes)
         VALUES ($1, 'purchase_in', $2, 'purchase_order', $3, $4, 'Stock received from purchase order')`,
        [item.product_id, item.quantity, id, req.user.id]
      );
    }

    await client.query(`UPDATE purchase_orders SET status = 'received', received_at = now() WHERE id = $1`, [id]);
    await client.query('COMMIT');

    await logActivity({
      userId: req.user.id, action: 'PURCHASE_ORDER_RECEIVED', entityType: 'purchase_order',
      entityId: id, ipAddress: req.ip,
    });

    res.json({ message: 'Stock received and inventory updated.' });
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.status || 500;
    if (status === 500) console.error('Receive PO error:', err);
    res.status(status).json({ error: err.message || 'Server error receiving purchase order.' });
  } finally {
    client.release();
  }
}

// POST /api/purchase-orders/:id/cancel
async function cancelPurchaseOrder(req, res) {
  const { id } = req.params;
  const { rows } = await db.query(
    `UPDATE purchase_orders SET status = 'cancelled' WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id]
  );
  if (rows.length === 0) return res.status(400).json({ error: 'Only pending purchase orders can be cancelled.' });

  await logActivity({
    userId: req.user.id, action: 'PURCHASE_ORDER_CANCELLED', entityType: 'purchase_order',
    entityId: id, ipAddress: req.ip,
  });

  res.json({ message: 'Purchase order cancelled.' });
}

module.exports = {
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder,
  receivePurchaseOrder, cancelPurchaseOrder,
};
