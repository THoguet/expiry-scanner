-- Add migration script here
CREATE TABLE products (
	id bigint GENERATED ALWAYS AS IDENTITY,
	barcode TEXT NOT NULL,
	client_id UUID NOT NULL,
	expiration_date DATE NOT NULL,
	created_at timestamp WITH TIME ZONE DEFAULT now() NOT NULL
)