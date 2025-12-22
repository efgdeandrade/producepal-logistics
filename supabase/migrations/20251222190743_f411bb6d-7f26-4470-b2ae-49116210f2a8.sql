-- Add preferred_payment_method column to fnb_customers for smart pre-fill
ALTER TABLE fnb_customers 
ADD COLUMN preferred_payment_method payment_method_type DEFAULT NULL;