const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

// GET /api/expenses?from=&to=
async function listExpenses(req, res) {
  const { from, to } = req.query;
  const conditions = [];
  const params = [];

  if (from) { params.push(from); conditions.push(`expense_date >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`expense_date <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT e.*, u.full_name AS recorded_by_name
     FROM expenses e LEFT JOIN users u ON u.id = e.recorded_by
     ${where}
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT 500`,
    params
  );
  res.json({ expenses: rows });
}

// POST /api/expenses
async function createExpense(req, res) {
  const { category, description, amountUsd, expenseDate } = req.body;
  if (!category || !amountUsd || amountUsd <= 0) {
    return res.status(400).json({ error: 'category and a positive amountUsd are required.' });
  }

  const { rows } = await db.query(
    `INSERT INTO expenses (category, description, amount_usd, recorded_by, expense_date)
     VALUES ($1,$2,$3,$4, COALESCE($5, CURRENT_DATE)) RETURNING *`,
    [category, description || null, amountUsd, req.user.id, expenseDate || null]
  );

  await logActivity({
    userId: req.user.id, action: 'EXPENSE_RECORDED', entityType: 'expense',
    entityId: rows[0].id, details: { category, amountUsd }, ipAddress: req.ip,
  });

  res.status(201).json({ expense: rows[0] });
}

module.exports = { listExpenses, createExpense };
