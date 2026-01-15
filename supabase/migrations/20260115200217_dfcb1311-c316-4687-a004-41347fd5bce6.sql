-- Remove public/anon permissive policies from sensitive tables
-- These policies allow unauthenticated access

-- distribution_customer_schedules
DROP POLICY IF EXISTS "Allow service role full access to schedules" ON distribution_customer_schedules;
DROP POLICY IF EXISTS "schedules_insert_admin_mgmt" ON distribution_customer_schedules;
DROP POLICY IF EXISTS "schedules_select_admin_mgmt" ON distribution_customer_schedules;
DROP POLICY IF EXISTS "schedules_update_admin_mgmt" ON distribution_customer_schedules;

-- distribution_order_anomalies
DROP POLICY IF EXISTS "Allow service role full access to anomalies" ON distribution_order_anomalies;
DROP POLICY IF EXISTS "anomalies_insert_admin_mgmt" ON distribution_order_anomalies;
DROP POLICY IF EXISTS "anomalies_select_admin_mgmt" ON distribution_order_anomalies;
DROP POLICY IF EXISTS "anomalies_update_admin_mgmt" ON distribution_order_anomalies;