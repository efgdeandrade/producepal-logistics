
-- Add new roles to app_role enum
-- These must be added before creating functions that reference them
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'import';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'sales';
