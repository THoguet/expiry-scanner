CREATE TABLE user_product_info (
	id bigint GENERATED ALWAYS AS IDENTITY,
	barcode TEXT NOT NULL,
	name TEXT,
	image TEXT,
	client_id UUID NOT NULL,
	created_at timestamp WITH TIME ZONE DEFAULT now() NOT NULL,
	updated_at timestamp WITH TIME ZONE DEFAULT now() NOT NULL,
	CONSTRAINT user_product_info_barcode_client_unique UNIQUE (barcode, client_id)
);

CREATE INDEX idx_user_product_info_barcode_client ON user_product_info (barcode, client_id);
CREATE INDEX idx_user_product_info_barcode ON user_product_info (barcode);
