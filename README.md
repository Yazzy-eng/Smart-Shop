# Deeqsan Store POS — Foundation + Sales & Billing

This build includes the full authentication/roles foundation plus a working
Sales & Billing module. Inventory (basic), Customers (basic), and Settings
(exchange rate) are also functional enough to support real checkout testing.
Full Customer statements, Reports/Dashboard, and Administration screens come next.

## What's included

**Backend** (`/backend` — Node.js + Express + PostgreSQL)
- Full database schema (`sql/schema.sql`): users, roles, products, categories,
  suppliers, customers, sales, sale_items, payments, inventory_transactions,
  purchase_orders, expenses, exchange_rates, activity_logs, user_sessions.
- JWT auth (short-lived access token + rotating refresh token), bcrypt password
  hashing, role-based middleware (admin/manager/cashier), rate-limited login,
  audit logging on every sensitive action.
- Configurable USD → SOS exchange rate endpoint.
- **Products**: barcode lookup, search, create/update/deactivate (admin/manager).
- **Customers**: walk-in vs monthly-account, search, account statements,
  recording payments against an account balance.
- **Sales (the core POS transaction)**: validates stock, supports item-level
  and order-level discounts, tax, dual-currency totals (USD/SOS), multiple
  payment methods (cash/mobile money/bank), on-account charging for account
  customers, automatic stock deduction with an inventory ledger entry per
  line, full audit logging, and admin/manager void with stock restoration.

**Frontend** (`/frontend` — React + Tailwind CSS + Vite)
- Login, session timeout, role-aware navigation (from the foundation build).
- **Sales / POS screen**: barcode scan or type-ahead search, live cart with
  editable quantities, walk-in name or account-customer lookup, discount/tax
  fields, USD/SOS currency toggle, payment method selection, checkout, and a
  printable receipt view.
- **Inventory screen**: add products (name, barcode, SKU, price, stock,
  reorder level) and see the current product list with low-stock highlighted.
- **Settings screen**: view and update the USD → SOS exchange rate.
- Customers, Reports, User Management, and Admin Settings pages beyond the
  above remain placeholders for now.

## Setup

### 1. Database
Create a PostgreSQL database (e.g. a Supabase project), then run:
```bash
psql "$DATABASE_URL" -f backend/sql/schema.sql
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# edit .env: set DATABASE_URL, JWT secrets, SEED_ADMIN_PASSWORD
npm install
npm run seed:admin      # creates your first Admin login
npm run dev             # starts on http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev              # starts on http://localhost:5173
```

## Using the app once deployed
1. Log in as Admin (or Manager/Cashier, once created via User Management).
2. Go to **Settings** and set the USD → SOS exchange rate — checkout won't
   work until this is set.
3. Go to **Inventory** and add at least one product (barcode optional, but
   useful for scanning).
4. Go to **Sales / POS**, search or scan the product, adjust quantity,
   choose a walk-in or account customer, pick a payment method, and check out.
5. Print or review the receipt.

## Security notes already in place
- Passwords hashed with bcrypt (12 rounds); access tokens expire in 15 minutes;
  refresh tokens stored server-side in `user_sessions`.
- Idle sessions auto-log-out client-side after inactivity.
- Every login, failed login, logout, user/customer/product change, sale, and
  exchange-rate change writes to `activity_logs` — the audit trail required
  by the spec.
- Login endpoint is rate-limited (10 attempts / 15 min per IP).

## What's next
Suggested order: **Customers (full statements + credit limits)**, then
**Reports & Dashboard** (daily/weekly/monthly sales, profit & loss,
best-sellers, cashier performance, PDF/Excel export), then
**Administration** (user management screen, backups, audit log viewer).

