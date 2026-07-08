-- Migration: shop settings (key-value store for shop name/address/phone etc.)
-- Run this in Supabase SQL editor the same way you ran schema.sql.

CREATE TABLE IF NOT EXISTS shop_settings (
    key         VARCHAR(50) PRIMARY KEY,
    value       TEXT,
    updated_by  UUID REFERENCES users(id),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO shop_settings (key, value) VALUES
    ('shop_name', 'Deeqsan Store'),
    ('shop_address', 'Hargeisa, Somaliland'),
    ('shop_phone', '')
ON CONFLICT (key) DO NOTHING;
