-- Create table for learning Papiamentu/local context words
CREATE TABLE public.fnb_context_words (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL,
  word_type TEXT NOT NULL CHECK (word_type IN ('unit', 'quantity_phrase', 'product_modifier', 'action', 'connector', 'time_reference')),
  meaning TEXT NOT NULL,
  language TEXT DEFAULT 'pap',
  usage_count INTEGER DEFAULT 1,
  examples TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(word)
);

-- Enable RLS
ALTER TABLE public.fnb_context_words ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read context words
CREATE POLICY "Authenticated users can view context words"
ON public.fnb_context_words
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert new context words
CREATE POLICY "Authenticated users can insert context words"
ON public.fnb_context_words
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update context words
CREATE POLICY "Authenticated users can update context words"
ON public.fnb_context_words
FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to delete context words
CREATE POLICY "Authenticated users can delete context words"
ON public.fnb_context_words
FOR DELETE
TO authenticated
USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_fnb_context_words_updated_at
BEFORE UPDATE ON public.fnb_context_words
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed some common Papiamentu words
INSERT INTO public.fnb_context_words (word, word_type, meaning, language, is_verified, examples) VALUES
('kaha', 'unit', 'box/case', 'pap', true, ARRAY['5 kaha tomato', '2 kaha piña']),
('kashi', 'unit', 'box/case (alternate spelling)', 'pap', true, ARRAY['3 kashi pampuna']),
('tros', 'unit', 'bunch', 'pap', true, ARRAY['2 tros banana', '1 tros sla']),
('saku', 'unit', 'bag/sack', 'pap', true, ARRAY['1 saku aros', '2 saku bonchi']),
('mi ke', 'action', 'I want', 'pap', true, ARRAY['mi ke 5 kaha tomato']),
('manda', 'action', 'send', 'pap', true, ARRAY['manda mi 3 kaha']),
('traha', 'action', 'send/prepare', 'pap', true, ARRAY['traha mi orden']),
('pa', 'connector', 'for', 'pap', true, ARRAY['pa mañan', 'pa djaweps']),
('mañan', 'time_reference', 'tomorrow', 'pap', true, ARRAY['pa mañan']),
('awe', 'time_reference', 'today', 'pap', true, ARRAY['pa awe']),
('djaweps', 'time_reference', 'Thursday', 'pap', true, ARRAY['pa djaweps']),
('diabierna', 'time_reference', 'Friday', 'pap', true, ARRAY['pa diabierna']),
('diasabra', 'time_reference', 'Saturday', 'pap', true, ARRAY['pa diasabra']),
('djaluna', 'time_reference', 'Monday', 'pap', true, ARRAY['pa djaluna']),
('djamars', 'time_reference', 'Tuesday', 'pap', true, ARRAY['pa djamars']),
('djarason', 'time_reference', 'Wednesday', 'pap', true, ARRAY['pa djarason']),
('grandi', 'product_modifier', 'large/big', 'pap', true, ARRAY['tomato grandi']),
('chikitu', 'product_modifier', 'small', 'pap', true, ARRAY['piña chikitu']),
('yen', 'product_modifier', 'ripe', 'pap', true, ARRAY['banana yen']),
('bèrdè', 'product_modifier', 'green/unripe', 'pap', true, ARRAY['banana bèrdè']),
('kilo', 'unit', 'kilogram', 'mixed', true, ARRAY['5 kilo tomato']),
('liber', 'unit', 'pound', 'pap', true, ARRAY['10 liber karni']),
('pida', 'unit', 'piece', 'pap', true, ARRAY['3 pida piña']),
('kada', 'quantity_phrase', 'each', 'pap', true, ARRAY['2 kada']),
('tur', 'quantity_phrase', 'all', 'pap', true, ARRAY['tur tomato']),
('mesun', 'quantity_phrase', 'same as usual', 'pap', true, ARRAY['mesun di semper'])
ON CONFLICT (word) DO NOTHING;