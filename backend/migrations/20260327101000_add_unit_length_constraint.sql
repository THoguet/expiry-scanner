-- Add constraint to ensure unit is max 4 characters
ALTER TABLE stock
ADD CONSTRAINT stock_unit_max_length CHECK (
    unit IS NULL
    OR length(unit) <= 4
);