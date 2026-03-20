-- Fix all existing telegram/whatsapp orders
UPDATE distribution_orders 
SET items_count = (
  SELECT COUNT(*) 
  FROM distribution_order_items 
  WHERE order_id = distribution_orders.id
)
WHERE source_channel IN ('telegram', 'whatsapp');

-- Add a trigger to keep items_count in sync automatically
CREATE OR REPLACE FUNCTION update_order_items_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE distribution_orders 
    SET items_count = (
      SELECT COUNT(*) FROM distribution_order_items WHERE order_id = NEW.order_id
    )
    WHERE id = NEW.order_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE distribution_orders 
    SET items_count = (
      SELECT COUNT(*) FROM distribution_order_items WHERE order_id = OLD.order_id
    )
    WHERE id = OLD.order_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_order_items_count ON distribution_order_items;
CREATE TRIGGER sync_order_items_count
AFTER INSERT OR DELETE ON distribution_order_items
FOR EACH ROW EXECUTE FUNCTION update_order_items_count();