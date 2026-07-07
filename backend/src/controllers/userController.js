const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

async function listUsers(req, res) {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.username, u.email, u.phone, u.is_active,
            u.last_login_at, u.created_at, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id
     ORDER BY u.created_at DESC`
  );
  res.json({ users: rows });
}

async function createUser(req, res) {
  const { fullName, username, email, phone, password, roleName } = req.body;
  if (!fullName || !username || !password || !roleName) {
    return res.status(400).json({ error: 'fullName, username, password, and roleName are required.' });
  }

  try {
    const { rows: roleRows } = await db.query(`SELECT id FROM roles WHERE name = $1`, [roleName]);
    if (roleRows.length === 0) {
      return res.status(400).json({ error: `Unknown role: ${roleName}` });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await db.query(
      `INSERT INTO users (full_name, username, email, phone, password_hash, role_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, username, email, phone, is_active, created_at`,
      [fullName, username, email || null, phone || null, passwordHash, roleRows[0].id]
    );

    await logActivity({
      userId: req.user.id,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: rows[0].id,
      details: { username, roleName },
      ipAddress: req.ip,
    });

    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Server error creating user.' });
  }
}

async function updateUserStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  await db.query(`UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2`, [isActive, id]);

  await logActivity({
    userId: req.user.id,
    action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    entityType: 'user',
    entityId: id,
    ipAddress: req.ip,
  });

  res.json({ message: 'User status updated.' });
}

async function resetPassword(req, res) {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.query(
    `UPDATE users SET password_hash = $1, must_change_password = true, updated_at = now() WHERE id = $2`,
    [passwordHash, id]
  );

  await logActivity({
    userId: req.user.id,
    action: 'PASSWORD_RESET',
    entityType: 'user',
    entityId: id,
    ipAddress: req.ip,
  });

  res.json({ message: 'Password reset. User must change password at next login.' });
}

module.exports = { listUsers, createUser, updateUserStatus, resetPassword };
