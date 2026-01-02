-- Add PO number to orders table
ALTER TABLE fnb_orders ADD COLUMN po_number TEXT;

-- Add index for PO number lookups
CREATE INDEX idx_fnb_orders_po_number ON fnb_orders(po_number);