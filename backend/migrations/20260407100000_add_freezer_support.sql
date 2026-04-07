-- Add was_previously_frozen flag to products table
ALTER TABLE products
ADD COLUMN was_previously_frozen BOOLEAN NOT NULL DEFAULT FALSE;

-- Create frozen_products table
CREATE TABLE frozen_products (
    id BIGSERIAL PRIMARY KEY,
    barcode TEXT NOT NULL,
    name TEXT NOT NULL,
    image TEXT,
    frozen_date DATE NOT NULL DEFAULT CURRENT_DATE,
    client_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_frozen_products_client_id ON frozen_products (client_id);