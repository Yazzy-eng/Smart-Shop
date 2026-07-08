const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

// GET /api/products?search=&barcode=&lowStock=true
async function listProducts(req, res) {
  const { search, barcode, lowStock } = req.query;
  const conditions = ['p.is_active = true'];
  const params = [];

  if (barcode) {
    params.push(barcode);
    conditions.push(`barcode = $${params.length}`);
  } else if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length} OR barcode ILIKE $${params.length})`);
  }

  if (lowStock === 'true') {
    conditions.push('quantity_on_hand <= reorder_level');
  }

  const { rows } = await db.query(
    `SELECT p.*, c.name AS category_name, s.name AS supplier_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.name ASC
     LIMIT 100`,
    params
  );
  res.json({ products: rows });
}

// GET /api/products/:id
async function getProduct(req, res) {
  const { rows } = await db.query(`SELECT * FROM products WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product: rows[0] });
}

// POST /api/products  (admin/manager only)
async function createProduct(req, res) {
  const {
    sku, barcode, name, description, categoryId, supplierId,
    costPriceUsd, sellPriceUsd, unit, quantityOnHand, reorderLevel, expiryDate,
  } = req.body;

  if (!name || sellPriceUsd === undefined) {
    return res.status(400).json({ error: 'name and sellPriceUsd are required.' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO products
        (sku, barcode, name, description, category_id, supplier_id, cost_price_usd, sell_price_usd, unit, quantity_on_hand, reorder_level, expiry_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        sku || null, barcode || null, name, description || null,
        categoryId || null, supplierId || null,
        costPriceUsd || 0, sellPriceUsd, unit || 'pcs',
        quantityOnHand || 0, reorderLevel || 5, expiryDate || null,
      ]
    );

    await logActivity({
      userId: req.user.id, action: 'PRODUCT_CREATED', entityType: 'product',
      entityId: rows[0].id, details: { name }, ipAddress: req.ip,
    });

    res.status(201).json({ product: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A product with that SKU or barcode already exists.' });
    }
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Server error creating product.' });
  }
}

// PATCH /api/products/:id  (admin/manager only)
async function updateProduct(req, res) {
  const { id } = req.params;
  const fields = req.body;
  const allowed = [
    'sku', 'barcode', 'name', 'description', 'category_id', 'supplier_id',
    'cost_price_usd', 'sell_price_usd', 'unit', 'quantity_on_hand',
    'reorder_level', 'expiry_date', 'is_active',
  ];

  const camelToSnake = {
    categoryId: 'category_id', supplierId: 'supplier_id', costPriceUsd: 'cost_price_usd',
    sellPriceUsd: 'sell_price_usd', quantityOnHand: 'quantity_on_hand',
    reorderLevel: 'reorder_level', expiryDate: 'expiry_date', isActive: 'is_active',
  };

  const setClauses = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    const col = camelToSnake[key] || key;
    if (allowed.includes(col)) {
      params.push(value);
      setClauses.push(`${col} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }

  params.push(id);
  const { rows } = await db.query(
    `UPDATE products SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
    params
  );

  if (rows.length === 0) return res.status(404).json({ error: 'Product not found.' });

  await logActivity({
    userId: req.user.id, action: 'PRODUCT_UPDATED', entityType: 'product',
    entityId: id, details: fields, ipAddress: req.ip,
  });

  res.json({ product: rows[0] });
}

// DELETE /api/products/:id  (soft delete, admin/manager only)
async function deactivateProduct(req, res) {
  const { id } = req.params;
  await db.query(`UPDATE products SET is_active = false, updated_at = now() WHERE id = $1`, [id]);
  await logActivity({
    userId: req.user.id, action: 'PRODUCT_DEACTIVATED', entityType: 'product',
    entityId: id, ipAddress: req.ip,
  });
  res.json({ message: 'Product deactivated.' });
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, deactivateProduct };
