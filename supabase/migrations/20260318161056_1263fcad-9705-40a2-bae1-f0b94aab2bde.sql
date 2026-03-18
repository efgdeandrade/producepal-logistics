
ALTER TABLE distribution_orders
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS total_xcg numeric DEFAULT 0;

CREATE OR REPLACE VIEW finance_revenue_summary AS
SELECT
  DATE_TRUNC('week', o.created_at) as week_start,
  DATE_TRUNC('month', o.created_at) as month_start,
  COUNT(DISTINCT o.id) as order_count,
  COUNT(DISTINCT o.customer_id) as customer_count,
  SUM(COALESCE(o.total_xcg, 0)) as total_revenue_xcg,
  SUM(CASE WHEN o.payment_method IN ('cod_cash','cod_swipe')
      THEN COALESCE(o.total_xcg, 0) ELSE 0 END) as cod_revenue_xcg,
  SUM(CASE WHEN o.payment_method NOT IN ('cod_cash','cod_swipe') OR o.payment_method IS NULL
      THEN COALESCE(o.total_xcg, 0) ELSE 0 END) as credit_revenue_xcg
FROM distribution_orders o
WHERE o.status IN ('confirmed','delivered','invoiced')
GROUP BY DATE_TRUNC('week', o.created_at), DATE_TRUNC('month', o.created_at);

CREATE OR REPLACE VIEW customer_outstanding_balances AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  c.customer_type,
  c.payment_terms,
  c.zone,
  COUNT(DISTINCT o.id) as unpaid_orders,
  SUM(COALESCE(o.total_xcg, 0)) as outstanding_xcg,
  MAX(o.created_at) as last_order_date,
  MIN(o.created_at) as oldest_unpaid_date
FROM distribution_customers c
JOIN distribution_orders o ON o.customer_id = c.id
WHERE o.status IN ('confirmed','delivered')
AND (o.payment_status IS NULL OR o.payment_status != 'paid')
GROUP BY c.id, c.name, c.customer_type, c.payment_terms, c.zone;

CREATE OR REPLACE VIEW marketing_customer_segments AS
SELECT
  c.id, c.name, c.customer_type, c.zone, c.preferred_language,
  c.created_at as customer_since,
  COUNT(DISTINCT o.id) as total_orders,
  SUM(COALESCE(o.total_xcg, 0)) as lifetime_revenue_xcg,
  MAX(o.created_at) as last_order_date,
  MIN(o.created_at) as first_order_date,
  EXTRACT(DAY FROM now() - MAX(o.created_at))::integer as days_since_last_order,
  CASE
    WHEN COUNT(DISTINCT o.id) = 0 THEN 'inactive'
    WHEN MAX(o.created_at) > now() - interval '7 days' THEN 'active'
    WHEN MAX(o.created_at) > now() - interval '30 days' THEN 'regular'
    WHEN MAX(o.created_at) > now() - interval '90 days' THEN 'at_risk'
    ELSE 'churned'
  END as segment
FROM distribution_customers c
LEFT JOIN distribution_orders o ON o.customer_id = c.id
  AND o.status IN ('confirmed','delivered','invoiced')
GROUP BY c.id, c.name, c.customer_type, c.zone, c.preferred_language, c.created_at;
