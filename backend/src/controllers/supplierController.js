const db = require('../config/db');
const { logActivity } = require('../utils/activityLogger');

async function listSuppliers(req, res) {
  const { rows } = await db.query(`SELECT * FROM suppliers WHERE is_active = true ORDER BY name ASC`);
  res.json({ suppliers: rows });
}

async function createSupplier(req, res) {
  const { name, contactPerson, phone, email, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Supplier name is required.' });

  const { rows } = await db.query(
    `INSERT INTO suppliers (name, contact_person, phone, email, address)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, contactPerson || null, phone || null, email || null, address || null]
  );

  await logActivity({
    userId: req.user.id, action: 'SUPPLIER_CREATED', entityType: 'supplier',
    entityId: rows[0].id, details: { name }, ipAddress: req.ip,
  });

  res.status(201).json({ supplier: rows[0] });
}

async function updateSupplier(req, res) {
  const { id } = req.params;
  const { name, contactPerson, phone, email, address, isActive } = req.body;

  const { rows } = await db.query(
    `UPDATE suppliers SET
       name = COALESCE($1, name), contact_person = COALESCE($2, contact_person),
       phone = COALESCE($3, phone), email = COALESCE($4, email),
       address = COALESCE($5, address), is_active = COALESCE($6, is_active)
     WHERE id = $7 RETURNING *`,
    [name, contactPerson, phone, email, address, isActive, id]
  );

  if (rows.length === 0) return res.status(404).json({ error: 'Supplier not found.' });

  await logActivity({
    userId: req.user.id, action: 'SUPPLIER_UPDATED', entityType: 'supplier',
    entityId: id, ipAddress: req.ip,
  });

  res.json({ supplier: rows[0] });
}

module.exports = { listSuppliers, createSupplier, updateSupplier };
