-- HR TABLES

CREATE TABLE IF NOT EXISTS payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  deductions numeric DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'draft',
  payment_date date,
  payment_method text,
  notes text,
  created_by uuid REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_staff ON payroll_records FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()
  AND role IN ('director','right_hand','manager')));

CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested integer NOT NULL DEFAULT 1,
  reason text,
  status text DEFAULT 'pending',
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY leave_read ON leave_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY leave_write ON leave_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY leave_manage ON leave_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()
  AND role IN ('director','right_hand','manager')));

CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  shift_type text DEFAULT 'regular',
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY shifts_read ON shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY shifts_write ON shifts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()
  AND role IN ('director','right_hand','manager')));

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS annual_leave_days integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS sick_leave_days integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS leave_days_used integer DEFAULT 0;

-- PRODUCTION TABLES

CREATE TABLE IF NOT EXISTS production_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES distribution_products(id),
  product_name text NOT NULL,
  quantity_available numeric DEFAULT 0,
  quantity_reserved numeric DEFAULT 0,
  unit text DEFAULT 'kg',
  last_updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id),
  notes text
);
ALTER TABLE production_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_read ON production_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY stock_write ON production_stock FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid()
  AND role IN ('director','right_hand','manager','employee')));

-- HR summary view for Rosa
CREATE OR REPLACE VIEW hr_summary AS
SELECT
  (SELECT COUNT(*) FROM employees WHERE status = 'active') as active_employees,
  (SELECT COUNT(*) FROM employees WHERE status = 'inactive') as inactive_employees,
  (SELECT COUNT(*) FROM time_entries WHERE DATE(clock_in) = CURRENT_DATE) as clocked_in_today,
  (SELECT COUNT(*) FROM employee_documents WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '30 days' AND status != 'expired') as documents_expiring_soon,
  (SELECT COUNT(*) FROM employee_documents WHERE expiry_date < CURRENT_DATE AND status != 'expired') as documents_expired,
  (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending') as pending_leave_requests,
  (SELECT COUNT(*) FROM payroll_records WHERE status = 'draft') as pending_payroll;

-- Production summary view for Gino
CREATE OR REPLACE VIEW production_summary AS
SELECT
  (SELECT COUNT(*) FROM production_orders WHERE status = 'pending' AND order_date = CURRENT_DATE) as pending_today,
  (SELECT COUNT(*) FROM production_orders WHERE status = 'completed' AND order_date = CURRENT_DATE) as completed_today,
  (SELECT COUNT(*) FROM production_orders WHERE status IN ('pending','in_progress') AND delivery_date < CURRENT_DATE) as overdue_orders,
  (SELECT COUNT(*) FROM distribution_orders WHERE status = 'confirmed' AND created_at > now() - interval '7 days') as confirmed_orders_week,
  (SELECT COUNT(*) FROM distribution_picker_queue WHERE status = 'pending') as picker_queue_pending;