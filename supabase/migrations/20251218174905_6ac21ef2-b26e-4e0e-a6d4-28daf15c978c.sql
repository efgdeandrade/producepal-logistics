-- Create fnb_delivery_zones table
CREATE TABLE public.fnb_delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fnb_delivery_zones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view active zones"
ON public.fnb_delivery_zones
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Management can view all zones"
ON public.fnb_delivery_zones
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

CREATE POLICY "Management can manage zones"
ON public.fnb_delivery_zones
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'management'::app_role));

-- Insert existing zones from hardcoded list
INSERT INTO public.fnb_delivery_zones (name, sort_order) VALUES
  ('Willemstad', 1),
  ('Punda', 2),
  ('Otrobanda', 3),
  ('Pietermaai', 4),
  ('Scharloo', 5),
  ('Salinja', 6),
  ('Brievengat', 7),
  ('Santa Rosa', 8),
  ('Jan Thiel', 9),
  ('Bapor Kibra', 10),
  ('Groot Kwartier', 11),
  ('Emmastad', 12),
  ('Julianadorp', 13),
  ('Mahaai', 14),
  ('Rooi Catootje', 15),
  ('Mundo Nobo', 16),
  ('Buena Vista', 17),
  ('Koraal Specht', 18),
  ('Cas Grandi', 19),
  ('Rio Canario', 20),
  ('Santa Maria', 21),
  ('Seru Fortuna', 22),
  ('Domi', 23),
  ('Banda Abou', 24),
  ('Westpunt', 25),
  ('Lagun', 26),
  ('Barber', 27),
  ('St. Willibrordus', 28),
  ('Tera Kora', 29),
  ('Fontein', 30);

-- Add trigger for updated_at
CREATE TRIGGER update_fnb_delivery_zones_updated_at
BEFORE UPDATE ON public.fnb_delivery_zones
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();