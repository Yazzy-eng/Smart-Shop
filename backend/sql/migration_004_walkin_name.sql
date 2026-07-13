-- Migration: store walk-in customer name directly on the sale
-- (so daily walk-in sales have a searchable record even without a full customer profile)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS walkin_customer_name VARCHAR(150);
