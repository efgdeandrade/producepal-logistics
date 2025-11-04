-- Create customers table with address information
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create routes table
CREATE TABLE public.routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_number TEXT NOT NULL,
  date DATE NOT NULL,
  driver_id UUID REFERENCES auth.users(id),
  driver_name TEXT NOT NULL,
  truck_identifier TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  estimated_duration INTEGER,
  actual_duration INTEGER,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create route_stops table (deliveries on a route)
CREATE TABLE public.route_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  sequence_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_time TIMESTAMP WITH TIME ZONE,
  arrival_time TIMESTAMP WITH TIME ZONE,
  completion_time TIMESTAMP WITH TIME ZONE,
  delivery_notes TEXT,
  photo_urls TEXT[],
  signature_url TEXT,
  order_id UUID REFERENCES public.orders(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

-- Customers policies
CREATE POLICY "Authenticated users can view customers"
  ON public.customers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and management can manage customers"
  ON public.customers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Routes policies
CREATE POLICY "Authenticated users can view routes"
  ON public.routes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Drivers can view their own routes"
  ON public.routes FOR SELECT
  USING (driver_id = auth.uid());

CREATE POLICY "Admins and management can manage routes"
  ON public.routes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Route stops policies
CREATE POLICY "Authenticated users can view route stops"
  ON public.route_stops FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Drivers can update their route stops"
  ON public.route_stops FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.routes
    WHERE routes.id = route_stops.route_id
    AND routes.driver_id = auth.uid()
  ));

CREATE POLICY "Admins and management can manage route stops"
  ON public.route_stops FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Add driver role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'driver';

-- Create triggers for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_routes_updated_at
  BEFORE UPDATE ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_route_stops_updated_at
  BEFORE UPDATE ON public.route_stops
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX idx_routes_driver_id ON public.routes(driver_id);
CREATE INDEX idx_routes_date ON public.routes(date);
CREATE INDEX idx_route_stops_route_id ON public.route_stops(route_id);
CREATE INDEX idx_route_stops_customer_id ON public.route_stops(customer_id);
CREATE INDEX idx_customers_name ON public.customers(name);