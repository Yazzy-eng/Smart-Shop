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

// GET /api/admin/backup — downloadable JSON snapshot of all business data
// (users' password hashes are excluded; Supabase's own automatic backups
// remain the safety net for full database restore.)
router.get('/backup', async (req, res) => {
  try {
    const tables = [
      'roles', 'categories', 'suppliers', 'products', 'customers',
      'sales', 'sale_items', 'payments', 'inventory_transactions',
      'purchase_orders', 'purchase_order_items', 'expenses',
      'exchange_rates', 'shop_settings',
    ];

    const backup = { generatedAt: new Date().toISOString(), tables: {} };
    for (const table of tables) {
      const { rows } = await db.query(`SELECT * FROM ${table}`);
      backup.tables[table] = rows;
    }

    // Users without password hashes or session tokens
    const { rows: users } = await db.query(
      `SELECT id, full_name, username, email, phone, role_id, is_active, last_login_at, created_at FROM users`
    );
    backup.tables.users = users;

    await logActivity({
      userId: req.user.id, action: 'BACKUP_DOWNLOADED', entityType: 'system', ipAddress: req.ip,
    });

    res.setHeader('Content-Disposition', `attachment; filename="deeqsan-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(backup);
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Could not generate backup.' });
  }
});

// GET /api/admin/roles — list roles with their permissions
router.get('/roles', async (req, res) => {
  const { rows } = await db.query(`SELECT id, name, description, permissions FROM roles ORDER BY id ASC`);
  res.json({ roles: rows });
});

// PUT /api/admin/roles/:id — update a role's permissions
// (the admin role's "all" superuser flag is protected and cannot be removed here,
// to prevent accidentally locking every admin account out of the system.)
router.put('/roles/:id', async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;

  const { rows: existing } = await db.query(`SELECT name, permissions FROM roles WHERE id = $1`, [id]);
  if (existing.length === 0) return res.status(404).json({ error: 'Role not found.' });

  let newPermissions = permissions;
  if (existing[0].name === 'admin') {
    newPermissions = { ...permissions, all: true };
  }

  const { rows } = await db.query(
    `UPDATE roles SET permissions = $1 WHERE id = $2 RETURNING id, name, description, permissions`,
    [JSON.stringify(newPermissions), id]
  );

  await logActivity({
    userId: req.user.id, action: 'ROLE_PERMISSIONS_UPDATED', entityType: 'role',
    entityId: id, details: { roleName: rows[0].name }, ipAddress: req.ip,
  });

  res.json({ role: rows[0] });
});

module.exports = router;
