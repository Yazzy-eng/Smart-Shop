const db = require('../config/db');

/**
 * Records an entry in activity_logs. Used for audit trail requirements:
 * logins/logouts, sales created, product/customer changes, etc.
 */
async function logActivity({ userId = null, action, entityType = null, entityId = null, details = {}, ipAddress = null }) {
  try {
    await db.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, JSON.stringify(details), ipAddress]
    );
  } catch (err) {
    // Logging must never break the main request flow.
    console.error('Failed to write activity log:', err.message);
  }
}

module.exports = { logActivity };
