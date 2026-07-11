const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

router.use(requireAuth, requireRole('admin'));

// GET /api/admin/audit-logs?action=&userId=&from=&to=&limit=
router.get('/audit-logs', async (req, res) => {
  const { action, userId, from, to, limit } = req.query;
  const conditions = [];
  const params = [];

  if (action) { params.push(action); conditions.push(`a.action = $${params.length}`); }
  if (userId) { params.push(userId); conditions.push(`a.user_id = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`a.created_at >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`a.created_at < ($${params.length}::date + INTERVAL '1 day')`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(parseInt(limit, 10) || 100, 500));

  const { rows } = await db.query(
    `SELECT a.*, u.full_name AS user_name, u.username
     FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  res.json({ logs: rows });
});

// GET /api/admin/shop-settings
router.get('/shop-settings', async (req, res) => {
  const { rows } = await db.query(`SELECT key, value FROM shop_settings`);
  const settings = {};
  rows.forEach((r) => { settings[r.key] = r.value; });
  res.json({ settings });
});

// PUT /api/admin/shop-settings
router.put('/shop-settings', async (req, res) => {
  const updates = req.body; // { shop_name, shop_address, shop_phone }
  const allowedKeys = ['shop_name', 'shop_address', 'shop_phone', 'receipt_width'];

  for (const [key, value] of Object.entries(updates)) {
    if (!allowedKeys.includes(key)) continue;
    await db.query(
      `INSERT INTO shop_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = now()`,
      [key, value, req.user.id]
    );
  }

  await logActivity({
    userId: req.user.id, action: 'SHOP_SETTINGS_UPDATED', entityType: 'shop_settings',
    details: updates, ipAddress: req.ip,
  });

  res.json({ message: 'Shop settings updated.' });
});

module.exports = router;
