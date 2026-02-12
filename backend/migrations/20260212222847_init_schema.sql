-- Add migration script here
CREATE TABLE products (
	id bigint GENERATED ALWAYS AS IDENTITY,
	barcode CHAR(13) CHECK (barcode ~ '^[0-9]{12,13}$') NOT NULL,
	expiration_date DATE NOT NULL,
	created_at timestamp WITH TIME ZONE DEFAULT now()
)