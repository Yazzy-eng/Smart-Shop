-- =========================================================
-- Deeqsan POS - PostgreSQL Schema
-- =========================================================
-- Run with: psql <connection_string> -f schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- ROLES & USERS
-- =========================================================
CREATE TABLE roles (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(50) UNIQUE NOT NULL,           -- admin, manager, cashier
    description     TEXT,
    permissions     JSONB DEFAULT '{}'::jsonb,             -- e.g. {"sales.create": true, "reports.view": true}
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name       VARCHAR(150) NOT NULL,
    username        VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(150) UNIQUE,
    phone           VARCHAR(30),
    password_hash   TEXT NOT NULL,
    role_id         INTEGER NOT NULL REFERENCES roles(id),
    is_active       BOOLEAN DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    must_change_password BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Refresh / session tokens (supports auto session-timeout + forced logout)
CREATE TABLE user_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   TEXT NOT NULL,
    ip_address      VARCHAR(50),
    user_agent      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- =========================================================
-- ACTIVITY / AUDIT LOGS
-- =========================================================
CREATE TABLE activity_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(100) NOT NULL,      -- LOGIN, LOGOUT, SALE_CREATED, PRODUCT_UPDATED, etc.
    entity_type     VARCHAR(50),                -- sale, product, customer, user...
    entity_id       VARCHAR(100),
    details         JSONB DEFAULT '{}'::jsonb,
    ip_address      VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at);

-- =========================================================
-- EXCHANGE RATES (USD <-> SOS)
-- =========================================================
CREATE TABLE exchange_rates (
    id              SERIAL PRIMARY KEY,
    base_currency   VARCHAR(3) NOT NULL DEFAULT 'USD',
    target_currency VARCHAR(3) NOT NULL DEFAULT 'SOS',
    rate            NUMERIC(14,4) NOT NULL,      -- e.g. 1 USD = 8700 SOS
    set_by          UUID REFERENCES users(id),
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_exchange_rates_active ON exchange_rates(is_active);

-- =========================================================
-- SUPPLIERS / CATEGORIES / PRODUCTS
-- =========================================================
CREATE TABLE suppliers (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    contact_person  VARCHAR(150),
    phone           VARCHAR(30),
    email           VARCHAR(150),
    address         TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE categories (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku             VARCHAR(60) UNIQUE,
    barcode         VARCHAR(60) UNIQUE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    category_id     INTEGER REFERENCES categories(id),
    supplier_id     INTEGER REFERENCES suppliers(id),
    cost_price_usd  NUMERIC(14,4) NOT NULL DEFAULT 0,
    sell_price_usd  NUMERIC(14,4) NOT NULL DEFAULT 0,
    unit            VARCHAR(30) DEFAULT 'pcs',
    quantity_on_hand NUMERIC(14,3) NOT NULL DEFAULT 0,
    reorder_level   NUMERIC(14,3) NOT NULL DEFAULT 5,
    expiry_date     DATE,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_low_stock ON products(quantity_on_hand, reorder_level);

-- =========================================================
-- PURCHASE ORDERS (stock in)
-- =========================================================
CREATE TABLE purchase_orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number       VARCHAR(40) UNIQUE NOT NULL,
    supplier_id     INTEGER REFERENCES suppliers(id),
    status          VARCHAR(20) DEFAULT 'pending',  -- pending, received, cancelled
    ordered_by      UUID REFERENCES users(id),
    ordered_at      TIMESTAMPTZ DEFAULT now(),
    received_at     TIMESTAMPTZ,
    notes           TEXT
);

CREATE TABLE purchase_order_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    quantity        NUMERIC(14,3) NOT NULL,
    unit_cost_usd   NUMERIC(14,4) NOT NULL
);

-- =========================================================
-- INVENTORY TRANSACTIONS (stock in/out ledger)
-- =========================================================
CREATE TABLE inventory_transactions (
    id              BIGSERIAL PRIMARY KEY,
    product_id      UUID NOT NULL REFERENCES products(id),
    type            VARCHAR(20) NOT NULL,   -- purchase_in, sale_out, adjustment, return
    quantity        NUMERIC(14,3) NOT NULL, -- positive = in, negative = out
    reference_type  VARCHAR(30),            -- 'sale', 'purchase_order', 'adjustment'
    reference_id    VARCHAR(100),
    performed_by    UUID REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_inv_txn_product ON inventory_transactions(product_id);

-- =========================================================
-- CUSTOMERS
-- =========================================================
CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(150) NOT NULL,
    phone           VARCHAR(30),
    email           VARCHAR(150),
    address         TEXT,
    customer_type   VARCHAR(20) NOT NULL DEFAULT 'walkin',  -- 'monthly_account' or 'walkin'
    credit_limit_usd NUMERIC(14,4) DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_customers_type ON customers(customer_type);

-- =========================================================
-- SALES / SALE ITEMS / PAYMENTS
-- =========================================================
CREATE TABLE sales (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number  VARCHAR(40) UNIQUE NOT NULL,
    customer_id     UUID REFERENCES customers(id),        -- null = anonymous walk-in
    cashier_id      UUID NOT NULL REFERENCES users(id),
    sale_currency   VARCHAR(3) NOT NULL DEFAULT 'USD',     -- currency the sale was recorded/displayed in
    exchange_rate_used NUMERIC(14,4) NOT NULL,
    subtotal_usd    NUMERIC(14,4) NOT NULL DEFAULT 0,
    discount_usd    NUMERIC(14,4) NOT NULL DEFAULT 0,
    tax_usd         NUMERIC(14,4) NOT NULL DEFAULT 0,
    total_usd       NUMERIC(14,4) NOT NULL DEFAULT 0,
    is_on_account   BOOLEAN DEFAULT false,                 -- true = charged to monthly account customer
    status          VARCHAR(20) DEFAULT 'completed',       -- completed, voided, refunded
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_created ON sales(created_at);

CREATE TABLE sale_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    quantity        NUMERIC(14,3) NOT NULL,
    unit_price_usd  NUMERIC(14,4) NOT NULL,
    discount_usd    NUMERIC(14,4) NOT NULL DEFAULT 0,
    line_total_usd  NUMERIC(14,4) NOT NULL
);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id         UUID REFERENCES sales(id) ON DELETE CASCADE,
    customer_id     UUID REFERENCES customers(id),   -- for statement/account payments not tied to one sale
    method          VARCHAR(20) NOT NULL,             -- cash, mobile_money, bank
    currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
    amount_usd      NUMERIC(14,4) NOT NULL,
    reference_note  VARCHAR(200),
    received_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_payments_sale ON payments(sale_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);

-- =========================================================
-- EXPENSES
-- =========================================================
CREATE TABLE expenses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category        VARCHAR(80) NOT NULL,     -- rent, utilities, transport...
    description     TEXT,
    amount_usd      NUMERIC(14,4) NOT NULL,
    recorded_by     UUID REFERENCES users(id),
    expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- =========================================================
-- SEED DATA: default roles
-- =========================================================
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Full system access', '{"all": true}'),
('manager', 'Manage inventory, customers, reports', '{
    "sales.create": true, "sales.void": true,
    "products.manage": true, "customers.manage": true,
    "reports.view": true, "expenses.manage": true,
    "users.manage": false, "settings.manage": false
}'),
('cashier', 'Point of sale only', '{
    "sales.create": true, "sales.void": false,
    "products.manage": false, "customers.manage": false,
    "reports.view": false, "expenses.manage": false
}')
ON CONFLICT (name) DO NOTHING;
