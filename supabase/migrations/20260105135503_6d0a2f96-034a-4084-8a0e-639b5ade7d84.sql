-- Phase 1: Delivery Infrastructure Upgrade - Database Schema

-- 1.1 Add zone hierarchy columns to fnb_delivery_zones
ALTER TABLE public.fnb_delivery_zones 
ADD COLUMN parent_zone_id uuid REFERENCES public.fnb_delivery_zones(id) ON DELETE SET NULL,
ADD COLUMN zone_type text NOT NULL DEFAULT 'sub' CHECK (zone_type IN ('major', 'sub'));

-- Create index for hierarchy queries
CREATE INDEX idx_fnb_delivery_zones_parent ON public.fnb_delivery_zones(parent_zone_id);

-- 1.2 Create driver_zone_assignments table
CREATE TABLE public.driver_zone_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES public.fnb_delivery_zones(id) ON DELETE CASCADE,
  date date NOT NULL,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(driver_id, zone_id, date)
);

-- Create indexes for efficient queries
CREATE INDEX idx_driver_zone_assignments_date ON public.driver_zone_assignments(date);
CREATE INDEX idx_driver_zone_assignments_zone ON public.driver_zone_assignments(zone_id);
CREATE INDEX idx_driver_zone_assignments_driver ON public.driver_zone_assignments(driver_id);

-- Enable RLS
ALTER TABLE public.driver_zone_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver_zone_assignments (managers and admins can manage)
CREATE POLICY "Authenticated users can view driver zone assignments"
  ON public.driver_zone_assignments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage driver zone assignments"
  ON public.driver_zone_assignments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_driver_zone_assignments_updated_at
  BEFORE UPDATE ON public.driver_zone_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 1.3 Add manual override columns to fnb_orders
ALTER TABLE public.fnb_orders
ADD COLUMN assignment_locked boolean NOT NULL DEFAULT false,
ADD COLUMN manual_override_by uuid REFERENCES public.profiles(id),
ADD COLUMN manual_override_at timestamp with time zone;