ALTER TABLE user_product_info
ADD COLUMN IF NOT EXISTS last_linked_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_user_product_info_last_linked_at ON user_product_info (last_linked_at);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);

CREATE INDEX IF NOT EXISTS idx_products_expiration_date ON products (expiration_date);

CREATE INDEX IF NOT EXISTS idx_stock_updated_at ON stock (updated_at);