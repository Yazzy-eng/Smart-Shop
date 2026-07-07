const { verifyAccessToken } = require('../utils/jwt');
const db = require('../config/db');

/**
 * Verifies the Bearer access token and attaches req.user = { id, username, role }.
 * Also enforces idle session timeout by checking last_login_at style activity
 * is handled client-side via short-lived access tokens + refresh rotation.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = verifyAccessToken(token);

    const { rows } = await db.query(
      `SELECT u.id, u.username, u.full_name, u.is_active, r.name AS role_name, r.permissions
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [payload.sub]
    );

    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Restricts a route to specific role names, e.g. requireRole('admin', 'manager').
 * Admins with permissions.all = true always pass.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (req.user.permissions && req.user.permissions.all === true) {
      return next();
    }
    if (!allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

/**
 * Restricts a route to a specific named permission key in the role's
 * permissions JSONB (e.g. requirePermission('reports.view')).
 */
function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const perms = req.user.permissions || {};
    if (perms.all === true || perms[permissionKey] === true) {
      return next();
    }
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  };
}

module.exports = { requireAuth, requireRole, requirePermission };
