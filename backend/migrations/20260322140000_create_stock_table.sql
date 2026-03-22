CREATE TABLE stock (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL,
    desired_quantity integer NOT NULL DEFAULT 0,
    current_quantity integer NOT NULL DEFAULT 0,
    unit text,
    location text,
    client_id UUID NOT NULL,
    created_at timestamp WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at timestamp WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT stock_non_negative_quantities CHECK (
        desired_quantity >= 0
        AND current_quantity >= 0
    ),
    CONSTRAINT stock_name_not_blank CHECK (btrim(name) <> '')
);

CREATE INDEX idx_stock_client ON stock (client_id);