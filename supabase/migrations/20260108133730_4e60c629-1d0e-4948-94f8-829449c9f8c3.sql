-- Create translations table for full dictionary entries
CREATE TABLE public.fnb_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  papiamentu TEXT NOT NULL UNIQUE,
  dutch TEXT,
  english TEXT,
  spanish TEXT,
  category TEXT, -- 'food', 'unit', 'number', 'time', 'action', 'modifier', 'connector', 'greeting'
  grammatical_type TEXT, -- 'noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction'
  is_verified BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'dictionary',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for translations
CREATE INDEX idx_fnb_translations_papiamentu ON public.fnb_translations(papiamentu);
CREATE INDEX idx_fnb_translations_category ON public.fnb_translations(category);
CREATE INDEX idx_fnb_translations_dutch ON public.fnb_translations(dutch);

-- Create response templates table for future AI conversations
CREATE TABLE public.fnb_response_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent TEXT NOT NULL,
  template_papiamentu TEXT NOT NULL,
  template_dutch TEXT,
  template_english TEXT,
  variables TEXT[], -- ['customer_name', 'product', 'quantity', 'date']
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for response templates
CREATE INDEX idx_fnb_response_templates_intent ON public.fnb_response_templates(intent);

-- Create conversation intents table
CREATE TABLE public.fnb_conversation_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent TEXT NOT NULL UNIQUE,
  description TEXT,
  trigger_phrases TEXT[], -- Papiamentu phrases that trigger this intent
  response_template_id UUID REFERENCES public.fnb_response_templates(id),
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for intents
CREATE INDEX idx_fnb_conversation_intents_intent ON public.fnb_conversation_intents(intent);

-- Enable RLS on all tables
ALTER TABLE public.fnb_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fnb_response_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fnb_conversation_intents ENABLE ROW LEVEL SECURITY;

-- RLS policies for fnb_translations (readable by all authenticated, writable by admins)
CREATE POLICY "Translations are viewable by authenticated users"
  ON public.fnb_translations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Translations can be inserted by authenticated users"
  ON public.fnb_translations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Translations can be updated by authenticated users"
  ON public.fnb_translations FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Translations can be deleted by authenticated users"
  ON public.fnb_translations FOR DELETE
  TO authenticated
  USING (true);

-- RLS policies for fnb_response_templates
CREATE POLICY "Response templates are viewable by authenticated users"
  ON public.fnb_response_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Response templates can be inserted by authenticated users"
  ON public.fnb_response_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Response templates can be updated by authenticated users"
  ON public.fnb_response_templates FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Response templates can be deleted by authenticated users"
  ON public.fnb_response_templates FOR DELETE
  TO authenticated
  USING (true);

-- RLS policies for fnb_conversation_intents
CREATE POLICY "Conversation intents are viewable by authenticated users"
  ON public.fnb_conversation_intents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Conversation intents can be inserted by authenticated users"
  ON public.fnb_conversation_intents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Conversation intents can be updated by authenticated users"
  ON public.fnb_conversation_intents FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Conversation intents can be deleted by authenticated users"
  ON public.fnb_conversation_intents FOR DELETE
  TO authenticated
  USING (true);

-- Add updated_at triggers
CREATE TRIGGER update_fnb_translations_updated_at
  BEFORE UPDATE ON public.fnb_translations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fnb_response_templates_updated_at
  BEFORE UPDATE ON public.fnb_response_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fnb_conversation_intents_updated_at
  BEFORE UPDATE ON public.fnb_conversation_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some initial response templates for future use
INSERT INTO public.fnb_response_templates (intent, template_papiamentu, template_dutch, template_english, variables) VALUES
  ('greeting_morning', 'Bon dia {customer_name}! Con mi por yuda bo?', 'Goedemorgen {customer_name}! Hoe kan ik u helpen?', 'Good morning {customer_name}! How can I help you?', ARRAY['customer_name']),
  ('greeting_afternoon', 'Bon tardi {customer_name}! Con mi por yuda bo?', 'Goedemiddag {customer_name}! Hoe kan ik u helpen?', 'Good afternoon {customer_name}! How can I help you?', ARRAY['customer_name']),
  ('greeting_evening', 'Bon nochi {customer_name}! Con mi por yuda bo?', 'Goedenavond {customer_name}! Hoe kan ik u helpen?', 'Good evening {customer_name}! How can I help you?', ARRAY['customer_name']),
  ('order_confirm', 'Perfekto! Mi a risibí bo order pa {quantity} {product}. Ta pa {date}?', 'Perfect! Ik heb uw bestelling voor {quantity} {product} ontvangen. Is dat voor {date}?', 'Perfect! I received your order for {quantity} {product}. Is that for {date}?', ARRAY['quantity', 'product', 'date']),
  ('ask_quantity', 'Cuanto {product} bo ke? Nos tin {options}.', 'Hoeveel {product} wilt u? We hebben {options}.', 'How many {product} do you want? We have {options}.', ARRAY['product', 'options']),
  ('not_available', 'Sorry, nos no tin {product} awe. Nos ta spera deliveri {date}.', 'Sorry, we hebben vandaag geen {product}. We verwachten levering op {date}.', 'Sorry, we don''t have {product} today. We expect delivery on {date}.', ARRAY['product', 'date']),
  ('delivery_update', 'Bo order ta sali {time} awe. Driver: {driver_name}.', 'Uw bestelling vertrekt vandaag om {time}. Chauffeur: {driver_name}.', 'Your order leaves at {time} today. Driver: {driver_name}.', ARRAY['time', 'driver_name']),
  ('thank_you', 'Danki! Te un otro biaha!', 'Bedankt! Tot de volgende keer!', 'Thank you! See you next time!', ARRAY[]::TEXT[]),
  ('ask_clarification', 'Mi no a komprendé bon. Bo por ripití?', 'Ik heb het niet goed begrepen. Kunt u herhalen?', 'I didn''t understand well. Can you repeat?', ARRAY[]::TEXT[]),
  ('order_received', 'Order risibí! Nos ta prepará bo {items} pa {date}.', 'Bestelling ontvangen! We bereiden uw {items} voor {date}.', 'Order received! We are preparing your {items} for {date}.', ARRAY['items', 'date']);

-- Insert initial conversation intents
INSERT INTO public.fnb_conversation_intents (intent, description, trigger_phrases, priority) VALUES
  ('greeting', 'Customer greeting', ARRAY['bon dia', 'bon tardi', 'bon nochi', 'halo', 'ayo', 'hola', 'hi', 'hello'], 10),
  ('place_order', 'Customer wants to place an order', ARRAY['mi ke', 'manda mi', 'mi mester', 'order pa', 'mi ta pidi', 'duna mi'], 20),
  ('ask_availability', 'Customer asks about product availability', ARRAY['bo tin', 'tin unda', 'ta disponibel', 'tin ainda', 'tin stock'], 15),
  ('ask_price', 'Customer asks about price', ARRAY['cuanto ta', 'ki preis', 'ta cuanto', 'prijs', 'price'], 15),
  ('cancel_order', 'Customer wants to cancel', ARRAY['kansel', 'no mas', 'laga e bai', 'forget it', 'cancel'], 25),
  ('modify_order', 'Customer wants to modify order', ARRAY['kambia', 'modifiká', 'change', 'in lugar di', 'instead'], 20),
  ('confirm_order', 'Customer confirms order', ARRAY['si', 'korékto', 'ta bon', 'okay', 'ok', 'yes', 'correct'], 30),
  ('thank', 'Customer thanks', ARRAY['danki', 'masha danki', 'grashi', 'thanks', 'thank you', 'bedankt'], 5),
  ('ask_delivery', 'Customer asks about delivery', ARRAY['ki ora', 'kon ta bai', 'deliveri', 'entrega', 'when'], 15);