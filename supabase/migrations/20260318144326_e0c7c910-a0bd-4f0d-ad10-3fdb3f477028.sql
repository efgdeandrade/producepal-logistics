CREATE OR REPLACE FUNCTION get_customer_memory(p_customer_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'customer_name', c.name,
    'customer_type', c.customer_type,
    'preferred_language', c.preferred_language,
    'total_orders', (
      SELECT COUNT(*) FROM distribution_orders
      WHERE customer_id = p_customer_id AND status != 'cancelled'
    ),
    'last_order_days_ago', (
      SELECT EXTRACT(DAY FROM now() - MAX(created_at))::integer
      FROM distribution_orders
      WHERE customer_id = p_customer_id
    ),
    'last_order_items', (
      SELECT jsonb_agg(jsonb_build_object(
        'product', doi.product_name_raw,
        'qty', doi.quantity,
        'unit', doi.order_unit
      ))
      FROM distribution_order_items doi
      JOIN distribution_orders do2 ON do2.id = doi.order_id
      WHERE do2.customer_id = p_customer_id
      AND do2.id = (
        SELECT id FROM distribution_orders
        WHERE customer_id = p_customer_id
        ORDER BY created_at DESC LIMIT 1
      )
    ),
    'most_ordered_product', (
      SELECT doi.product_name_raw
      FROM distribution_order_items doi
      JOIN distribution_orders do3 ON do3.id = doi.order_id
      WHERE do3.customer_id = p_customer_id
      GROUP BY doi.product_name_raw
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    'avg_order_frequency_days', (
      SELECT ROUND(AVG(day_diff))::integer
      FROM (
        SELECT EXTRACT(DAY FROM created_at - LAG(created_at) OVER (ORDER BY created_at))::integer as day_diff
        FROM distribution_orders
        WHERE customer_id = p_customer_id AND status = 'confirmed'
      ) gaps
      WHERE day_diff IS NOT NULL
    )
  ) INTO result
  FROM distribution_customers c
  WHERE c.id = p_customer_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;