# Deeqsan Store POS — Foundation (Auth + Roles)

This is the first build phase of the full POS system: database schema,
secure authentication with role-based access control, and the app shell.
Sales/billing, inventory, customers, and reports come next.

## What's included

**Backend** (`/backend` — Node.js + Express + PostgreSQL)
- Full database schema (`sql/schema.sql`) covering every table from the spec:
  users, roles, products, categories, suppliers, customers, sales, sale_items,
  payments, inventory_transactions, purchase_orders, expenses, exchange_rates,
  activity_logs, user_sessions.
- JWT auth (short-lived access token + rotating refresh token stored server-side).
- bcrypt password hashing (12 salt rounds).
- Role-based middleware: `requireRole('admin', 'manager')`,
  `requirePermission('reports.view')` — three seeded roles (admin, manager, cashier).
- Activity/audit logging on login, login failures, logout, user changes,
  exchange rate changes (extends naturally to sales/inventory next).
- Rate limiting on `/auth/login` to slow brute-force attempts, plus a global
  baseline rate limit, `helmet` security headers, and CORS locked to your
  frontend origin.
- Configurable USD → SOS exchange rate endpoint (admin/manager only to set,
  any logged-in user can read the current rate for point-of-sale use).

**Frontend** (`/frontend` — React + Tailwind CSS + Vite)
- Login page.
- `AuthContext` handling login/logout, token storage, and automatic
  **session timeout after inactivity** (default 20 min, configurable).
- Axios client with automatic silent token refresh on 401.
- Role-aware sidebar navigation and protected routes — Admin sees
  everything, Manager sees sales/inventory/customers/reports, Cashier
  sees only Sales/POS and Dashboard.
- Placeholder pages for every upcoming module (Dashboard, POS, Customers,
  Inventory, Reports, User Management, Settings) — wired into routing so
  we can drop in real functionality module-by-module without re-plumbing.

## Setup

### 1. Database
Create a PostgreSQL database (e.g. a new Supabase project, same pattern as
your existing Deeqsan Store app), then run:
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

Log in with the admin username/password you set in `backend/.env`
(`SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`). You'll want to reset
that password immediately via User Management once we build it out, or
via the `resetPassword` endpoint already in place.

## Security notes already in place
- Passwords are never stored in plaintext (bcrypt, 12 rounds).
- Access tokens expire in 15 minutes; refresh tokens are stored server-side
  in `user_sessions` so logout / "revoke all sessions" is possible later.
- Idle sessions auto-log-out client-side after inactivity.
- Every login, failed login, logout, user change, and exchange-rate change
  writes to `activity_logs` — this is your audit trail, and the pattern
  extends directly to sales, inventory, and customer actions next.
- Login endpoint is rate-limited (10 attempts / 15 min per IP).

## What's next
Tell me which module to build first — I'd suggest **Sales & Billing (POS
screen + dual currency + barcode + receipt printing)** since it's the
highest-value daily-use feature, then Inventory, Customers, and Reports/
Dashboard after. Each will follow this same pattern: schema (already
done), Express routes + controllers, activity logging, then the React
screen.
