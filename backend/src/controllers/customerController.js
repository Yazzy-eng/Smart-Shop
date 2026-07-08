const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

// GET /api/customers?search=&type=monthly_account
async function listCustomers(req, res) {
  const { search, type } = req.query;
  const conditions = ['is_active = true'];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR phone ILIKE $${params.length})`);
  }
  if (type) {
    params.push(type);
    conditions.push(`customer_type = $${params.length}`);
  }

  const { rows } = await db.query(
    `SELECT c.*,
       COALESCE((
         SELECT SUM(s.total_usd) FROM sales s
         WHERE s.customer_id = c.id AND s.is_on_account = true AND s.status = 'completed'
       ), 0)
       - COALESCE((
         SELECT SUM(p.amount_usd) FROM payments p WHERE p.customer_id = c.id
       ), 0) AS outstanding_balance_usd
     FROM customers c
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.name ASC
     LIMIT 100`,
    params
  );
  res.json({ customers: rows });
}

async function getCustomer(req, res) {
  const { rows } = await db.query(`SELECT * FROM customers WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Customer not found.' });
  res.json({ customer: rows[0] });
}

// POST /api/customers
async function createCustomer(req, res) {
  const { name, phone, email, address, customerType, creditLimitUsd } = req.body;
  if (!name) return res.status(400).json({ error: 'Customer name is required.' });

  const { rows } = await db.query(
    `INSERT INTO customers (name, phone, email, address, customer_type, credit_limit_usd)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, phone || null, email || null, address || null, customerType || 'walkin', creditLimitUsd || 0]
  );

  await logActivity({
    userId: req.user.id, action: 'CUSTOMER_CREATED', entityType: 'customer',
    entityId: rows[0].id, details: { name }, ipAddress: req.ip,
  });

  res.status(201).json({ customer: rows[0] });
}

// PATCH /api/customers/:id
async function updateCustomer(req, res) {
  const { id } = req.params;
  const { name, phone, email, address, creditLimitUsd, isActive } = req.body;

  const { rows } = await db.query(
    `UPDATE customers SET
       name = COALESCE($1, name), phone = COALESCE($2, phone), email = COALESCE($3, email),
       address = COALESCE($4, address), credit_limit_usd = COALESCE($5, credit_limit_usd),
       is_active = COALESCE($6, is_active)
     WHERE id = $7 RETURNING *`,
    [name, phone, email, address, creditLimitUsd, isActive, id]
  );

  if (rows.length === 0) return res.status(404).json({ error: 'Customer not found.' });

  await logActivity({
    userId: req.user.id, action: 'CUSTOMER_UPDATED', entityType: 'customer',
    entityId: id, ipAddress: req.ip,
  });

  res.json({ customer: rows[0] });
}

// GET /api/customers/:id/statement  (monthly statement: sales on account + payments)
async function getStatement(req, res) {
  const { id } = req.params;

  const { rows: sales } = await db.query(
    `SELECT id, invoice_number, total_usd, created_at, status
     FROM sales WHERE customer_id = $1 AND is_on_account = true
     ORDER BY created_at DESC LIMIT 200`,
    [id]
  );

  const { rows: payments } = await db.query(
    `SELECT id, method, amount_usd, reference_note, created_at
     FROM payments WHERE customer_id = $1
     ORDER BY created_at DESC LIMIT 200`,
    [id]
  );

  const totalCharged = sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + Number(s.total_usd), 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_usd), 0);

  res.json({
    sales,
    payments,
    summary: {
      totalChargedUsd: totalCharged,
      totalPaidUsd: totalPaid,
      outstandingBalanceUsd: totalCharged - totalPaid,
    },
  });
}

// POST /api/customers/:id/payments  (record a payment against account balance)
async function recordPayment(req, res) {
  const { id } = req.params;
  const { method, amountUsd, currency, referenceNote } = req.body;

  if (!method || !amountUsd || amountUsd <= 0) {
    return res.status(400).json({ error: 'method and a positive amountUsd are required.' });
  }

  const { rows } = await db.query(
    `INSERT INTO payments (customer_id, method, currency, amount_usd, reference_note, received_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, method, currency || 'USD', amountUsd, referenceNote || null, req.user.id]
  );

  await logActivity({
    userId: req.user.id, action: 'CUSTOMER_PAYMENT_RECORDED', entityType: 'customer',
    entityId: id, details: { amountUsd, method }, ipAddress: req.ip,
  });

  res.status(201).json({ payment: rows[0] });
}

module.exports = { listCustomers, getCustomer, createCustomer, updateCustomer, getStatement, recordPayment };
