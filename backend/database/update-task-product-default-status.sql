-- Update default status for task_products to 'hoog_te_verwerken'
ALTER TABLE task_products 
ALTER COLUMN status SET DEFAULT 'hoog_te_verwerken';

-- Optionally update existing products with 'te_verwerken' to 'hoog_te_verwerken'
-- Uncomment the line below if you want to update existing records
-- UPDATE task_products SET status = 'hoog_te_verwerken' WHERE status = 'te_verwerken';
