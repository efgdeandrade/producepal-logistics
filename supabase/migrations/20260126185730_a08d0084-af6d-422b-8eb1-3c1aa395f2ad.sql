-- Drop the existing check constraint
ALTER TABLE public.distribution_context_words DROP CONSTRAINT IF EXISTS fnb_context_words_word_type_check;

-- Add a new comprehensive check constraint that includes ALL word types
ALTER TABLE public.distribution_context_words 
ADD CONSTRAINT fnb_context_words_word_type_check 
CHECK (word_type IN (
  -- Original system types
  'greeting', 'farewell', 'affirmative', 'negative', 'question', 
  'quantity', 'time_reference', 'product', 'action', 'modifier',
  'unit', 'connector', 'filler', 'escalation', 'confirmation',
  -- Existing custom types in database
  'product_modifier', 'quantity_phrase',
  -- Dictionary import types (from mapWordType function)
  'verb', 'noun', 'adjective', 'adverb', 'preposition', 
  'interjection', 'phrase', 'pronoun', 'article', 'conjunction',
  'numeral', 'exclamation', 'expression', 'idiom', 'slang'
));