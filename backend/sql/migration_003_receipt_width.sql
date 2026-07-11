-- Migration: add receipt paper width preference
-- Run this in Supabase SQL editor the same way as previous migrations.

INSERT INTO shop_settings (key, value) VALUES
    ('receipt_width', '80mm')
ON CONFLICT (key) DO NOTHING;
