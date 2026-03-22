UPDATE products p
SET name = b.product_name
FROM barcode_database b
WHERE p.name IS NULL
  AND p.barcode = b.code
  AND b.product_name IS NOT NULL
  AND btrim(b.product_name) <> '';

UPDATE products
SET name = barcode
WHERE name IS NULL OR btrim(name) = '';

ALTER TABLE products
ALTER COLUMN name SET NOT NULL;
