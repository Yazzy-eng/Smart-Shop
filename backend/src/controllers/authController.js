const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { logActivity } = require('../utils/activityLogger');

const REFRESH_EXPIRES_DAYS = 7;

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const { rows } = await db.query(
      `SELECT u.*, r.name AS role_name, r.permissions
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.username = $1`,
      [username]
    );
    const user = rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      await logActivity({
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        details: { username },
        ipAddress: req.ip,
      });
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO user_sessions (user_id, refresh_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, refreshToken, req.ip, req.headers['user-agent'] || null, expiresAt]
    );

    await db.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);

    await logActivity({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      details: { username },
      ipAddress: req.ip,
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        role: user.role_name,
        permissions: user.permissions,
        mustChangePassword: user.must_change_password,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
}

async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required.' });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);

    const { rows } = await db.query(
      `SELECT * FROM user_sessions
       WHERE refresh_token = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()`,
      [refreshToken, payload.sub]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    const { rows: userRows } = await db.query(
      `SELECT u.*, r.name AS role_name, r.permissions
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [payload.sub]
    );
    const user = userRows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated.' });
    }

    const accessToken = signAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  try {
    if (refreshToken) {
      await db.query(
        `UPDATE user_sessions SET revoked_at = now() WHERE refresh_token = $1`,
        [refreshToken]
      );
    }
    if (req.user) {
      await logActivity({
        userId: req.user.id,
        action: 'LOGOUT',
        entityType: 'user',
        entityId: req.user.id,
        ipAddress: req.ip,
      });
    }
    res.json({ message: 'Logged out.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Server error during logout.' });
  }
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, refresh, logout, me };
