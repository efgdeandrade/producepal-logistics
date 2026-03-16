
-- Migration 1: Add new enum values only (must be committed before use)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'director';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'business_partner';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'right_hand';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'employee';
ALTER TYPE customer_type ADD VALUE IF NOT EXISTS 'restaurant';
ALTER TYPE customer_type ADD VALUE IF NOT EXISTS 'hotel';
ALTER TYPE customer_type ADD VALUE IF NOT EXISTS 'walk_in';
ALTER TYPE customer_type ADD VALUE IF NOT EXISTS 'online';
