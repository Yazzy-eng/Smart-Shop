const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/settings/public — shop info + receipt width, readable by any logged-in user
// (cashiers need this to print correctly, not just admins)
router.get('/public', async (req, res) => {
  const { rows } = await db.query(
    `SELECT key, value FROM shop_settings WHERE key IN ('shop_name', 'shop_address', 'shop_phone', 'receipt_width')`
  );
  const settings = { shop_name: 'Deeqsan Store', shop_address: '', shop_phone: '', receipt_width: '80mm' };
  rows.forEach((r) => { settings[r.key] = r.value; });
  res.json({ settings });
});

module.exports = router;
