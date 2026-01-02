-- Create driver_availability table for managing driver schedules
CREATE TABLE public.driver_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN DEFAULT true,
  start_time TIME DEFAULT '07:00',
  end_time TIME DEFAULT '18:00',
  vehicle_capacity INTEGER DEFAULT 50,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(driver_id, date)
);

-- Enable RLS
ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view driver availability"
ON public.driver_availability
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can manage driver availability"
ON public.driver_availability
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Drivers can update their own availability
CREATE POLICY "Drivers can update own availability"
ON public.driver_availability
FOR UPDATE
USING (driver_id = auth.uid())
WITH CHECK (driver_id = auth.uid());

-- Add updated_at trigger
CREATE TRIGGER update_driver_availability_updated_at
BEFORE UPDATE ON public.driver_availability
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();