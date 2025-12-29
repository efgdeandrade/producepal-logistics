-- Add unique constraint on fnb_customer_patterns for upsert
ALTER TABLE fnb_customer_patterns 
ADD CONSTRAINT fnb_customer_patterns_customer_product_unique 
UNIQUE (customer_id, product_id);

-- Create function to update customer patterns when order items are created
CREATE OR REPLACE FUNCTION update_fnb_customer_patterns()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  -- Get customer_id from the order
  SELECT customer_id INTO v_customer_id 
  FROM fnb_orders 
  WHERE id = NEW.order_id;
  
  IF v_customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Upsert into patterns table
  INSERT INTO fnb_customer_patterns (customer_id, product_id, order_count, total_quantity, avg_quantity, last_ordered_at)
  VALUES (
    v_customer_id,
    NEW.product_id,
    1,
    NEW.quantity,
    NEW.quantity,
    NOW()
  )
  ON CONFLICT (customer_id, product_id) DO UPDATE SET
    order_count = fnb_customer_patterns.order_count + 1,
    total_quantity = fnb_customer_patterns.total_quantity + EXCLUDED.total_quantity,
    avg_quantity = (fnb_customer_patterns.total_quantity + EXCLUDED.total_quantity) / (fnb_customer_patterns.order_count + 1),
    last_ordered_at = NOW(),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on fnb_order_items
CREATE TRIGGER trigger_update_customer_patterns
AFTER INSERT ON fnb_order_items
FOR EACH ROW
EXECUTE FUNCTION update_fnb_customer_patterns();

-- Backfill existing order history into patterns
INSERT INTO fnb_customer_patterns (customer_id, product_id, order_count, total_quantity, avg_quantity, last_ordered_at)
SELECT 
  o.customer_id,
  oi.product_id,
  COUNT(DISTINCT o.id)::integer as order_count,
  SUM(oi.quantity) as total_quantity,
  AVG(oi.quantity) as avg_quantity,
  MAX(o.created_at) as last_ordered_at
FROM fnb_order_items oi
JOIN fnb_orders o ON o.id = oi.order_id
WHERE o.customer_id IS NOT NULL AND oi.product_id IS NOT NULL
GROUP BY o.customer_id, oi.product_id
ON CONFLICT (customer_id, product_id) DO NOTHING;