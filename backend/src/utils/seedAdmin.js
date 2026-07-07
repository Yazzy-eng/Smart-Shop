/**
 * Run once after migrating the schema:
 *   npm run seed:admin
 * Creates the first Admin account using SEED_ADMIN_* values from .env
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seedAdmin() {
  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_NAME || 'Administrator';

  if (!password || password.length < 8) {
    console.error('SEED_ADMIN_PASSWORD must be set in .env and be at least 8 characters.');
    process.exit(1);
  }

  const { rows: existing } = await db.query(`SELECT id FROM users WHERE username = $1`, [username]);
  if (existing.length > 0) {
    console.log(`Admin user "${username}" already exists. Nothing to do.`);
    process.exit(0);
  }

  const { rows: roleRows } = await db.query(`SELECT id FROM roles WHERE name = 'admin'`);
  if (roleRows.length === 0) {
    console.error('Admin role not found. Did you run the schema.sql migration first?');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.query(
    `INSERT INTO users (full_name, username, password_hash, role_id) VALUES ($1, $2, $3, $4)`,
    [fullName, username, passwordHash, roleRows[0].id]
  );

  console.log(`Admin user "${username}" created. Please log in and change the password immediately.`);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
