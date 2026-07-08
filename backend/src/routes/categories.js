const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await db.query(`SELECT * FROM categories ORDER BY name ASC`);
  res.json({ categories: rows });
});

router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required.' });
  try {
    const { rows } = await db.query(
      `INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *`,
      [name, description || null]
    );
    res.status(201).json({ category: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category already exists.' });
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Server error creating category.' });
  }
});

module.exports = router;
