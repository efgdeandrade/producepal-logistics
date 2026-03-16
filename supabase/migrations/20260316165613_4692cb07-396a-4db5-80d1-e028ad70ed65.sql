INSERT INTO distribution_customers (
  name, customer_type, preferred_language, 
  zone, payment_terms, whatsapp_phone
) VALUES (
  'Dreams Curacao Resorts Casino & Spa',
  'hotel',
  'english',
  'pabou',
  'net30',
  'pending'
) ON CONFLICT DO NOTHING;