-- Create function to merge two customers atomically
CREATE OR REPLACE FUNCTION public.merge_fnb_customers(
  primary_id UUID,
  secondary_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate inputs
  IF primary_id = secondary_id THEN
    RAISE EXCEPTION 'Cannot merge a customer with itself';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM fnb_customers WHERE id = primary_id) THEN
    RAISE EXCEPTION 'Primary customer not found';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM fnb_customers WHERE id = secondary_id) THEN
    RAISE EXCEPTION 'Secondary customer not found';
  END IF;

  -- Transfer all orders
  UPDATE fnb_orders 
  SET customer_id = primary_id 
  WHERE customer_id = secondary_id;
  
  -- Transfer conversations
  UPDATE fnb_conversations 
  SET customer_id = primary_id 
  WHERE customer_id = secondary_id;
  
  -- Transfer PO imports
  UPDATE fnb_po_imports 
  SET customer_id = primary_id 
  WHERE customer_id = secondary_id;
  
  -- Transfer unmatched items
  UPDATE fnb_unmatched_items 
  SET customer_id = primary_id 
  WHERE customer_id = secondary_id;
  
  -- Merge customer patterns (aggregate values)
  INSERT INTO fnb_customer_patterns (customer_id, product_id, order_count, total_quantity, avg_quantity, last_ordered_at)
  SELECT 
    primary_id,
    product_id,
    order_count,
    total_quantity,
    avg_quantity,
    last_ordered_at
  FROM fnb_customer_patterns
  WHERE customer_id = secondary_id
  ON CONFLICT (customer_id, product_id) DO UPDATE SET
    order_count = fnb_customer_patterns.order_count + EXCLUDED.order_count,
    total_quantity = fnb_customer_patterns.total_quantity + EXCLUDED.total_quantity,
    avg_quantity = (fnb_customer_patterns.total_quantity + EXCLUDED.total_quantity) / 
                   NULLIF(fnb_customer_patterns.order_count + EXCLUDED.order_count, 0),
    last_ordered_at = GREATEST(fnb_customer_patterns.last_ordered_at, EXCLUDED.last_ordered_at),
    updated_at = NOW();
  
  -- Delete secondary patterns after merge
  DELETE FROM fnb_customer_patterns WHERE customer_id = secondary_id;
  
  -- Merge product mappings (keep higher confidence, prefer verified)
  INSERT INTO fnb_customer_product_mappings (customer_id, customer_sku, customer_product_name, product_id, confidence_score, is_verified)
  SELECT 
    primary_id,
    customer_sku,
    customer_product_name,
    product_id,
    confidence_score,
    is_verified
  FROM fnb_customer_product_mappings
  WHERE customer_id = secondary_id
  ON CONFLICT (customer_id, customer_sku) DO UPDATE SET
    confidence_score = GREATEST(fnb_customer_product_mappings.confidence_score, EXCLUDED.confidence_score),
    is_verified = fnb_customer_product_mappings.is_verified OR EXCLUDED.is_verified,
    updated_at = NOW();
  
  -- Delete secondary mappings after merge
  DELETE FROM fnb_customer_product_mappings WHERE customer_id = secondary_id;
  
  -- Transfer standing order items
  UPDATE fnb_standing_order_items 
  SET customer_id = primary_id 
  WHERE customer_id = secondary_id;
  
  -- Finally delete the secondary customer
  DELETE FROM fnb_customers WHERE id = secondary_id;
END;
$$;