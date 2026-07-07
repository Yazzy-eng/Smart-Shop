const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

router.use(requireAuth);

// Anyone logged in can read the current active rate (needed at point of sale)
router.get('/current', async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM exchange_rates WHERE is_active = true ORDER BY created_at DESC LIMIT 1`
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: 'No exchange rate configured yet.' });
  }
  res.json({ rate: rows[0] });
});

router.get('/history', requireRole('admin', 'manager'), async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM exchange_rates ORDER BY created_at DESC LIMIT 100`
  );
  res.json({ rates: rows });
});

// Only admin/manager can update the configurable USD -> SOS rate
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { rate, baseCurrency = 'USD', targetCurrency = 'SOS' } = req.body;
  const numericRate = Number(rate);
  if (!numericRate || numericRate <= 0) {
    return res.status(400).json({ error: 'A valid positive rate is required.' });
  }

  const client = await require('../config/db').getClient();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE exchange_rates SET is_active = false WHERE is_active = true`);
    const { rows } = await client.query(
      `INSERT INTO exchange_rates (base_currency, target_currency, rate, set_by, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [baseCurrency, targetCurrency, numericRate, req.user.id]
    );
    await client.query('COMMIT');

    await logActivity({
      userId: req.user.id,
      action: 'EXCHANGE_RATE_UPDATED',
      entityType: 'exchange_rate',
      entityId: rows[0].id,
      details: { rate: numericRate, baseCurrency, targetCurrency },
      ipAddress: req.ip,
    });

    res.status(201).json({ rate: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Exchange rate update error:', err);
    res.status(500).json({ error: 'Server error updating exchange rate.' });
  } finally {
    client.release();
  }
});

module.exports = router;
