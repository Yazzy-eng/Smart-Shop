const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

// GET /api/roles
async function listRoles(req, res) {
  const { rows } = await db.query(`SELECT * FROM roles ORDER BY id ASC`);
  res.json({ roles: rows });
}

// PATCH /api/roles/:id  { permissions: { "sales.create": true, ... } }
async function updateRolePermissions(req, res) {
  const { id } = req.params;
  const { permissions } = req.body;

  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ error: 'permissions object is required.' });
  }

  const { rows: existing } = await db.query(`SELECT * FROM roles WHERE id = $1`, [id]);
  if (existing.length === 0) return res.status(404).json({ error: 'Role not found.' });

  // Never allow removing full admin access from the admin role itself —
  // that would be an easy way to accidentally lock everyone out.
  if (existing[0].name === 'admin' && permissions.all !== true) {
    return res.status(400).json({ error: 'The admin role must always keep full access ("all").' });
  }

  const { rows } = await db.query(
    `UPDATE roles SET permissions = $1 WHERE id = $2 RETURNING *`,
    [JSON.stringify(permissions), id]
  );

  await logActivity({
    userId: req.user.id, action: 'ROLE_PERMISSIONS_UPDATED', entityType: 'role',
    entityId: id, details: { roleName: existing[0].name, permissions }, ipAddress: req.ip,
  });

  res.json({ role: rows[0] });
}

module.exports = { listRoles, updateRolePermissions };
