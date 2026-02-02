-- Create table for WhatsApp message templates
CREATE TABLE public.whatsapp_message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name VARCHAR(255) NOT NULL UNIQUE,
  meta_template_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'marketing',
  purpose VARCHAR(100) NOT NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  preview_text TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_approved BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_templates_purpose ON whatsapp_message_templates(purpose, is_active, is_approved);
CREATE INDEX idx_templates_category ON whatsapp_message_templates(category);

-- Enable RLS
ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view templates
CREATE POLICY "Authenticated users can view templates"
  ON public.whatsapp_message_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to manage templates
CREATE POLICY "Admins can manage templates"
  ON public.whatsapp_message_templates
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Track template send history for analytics and rotation
CREATE TABLE public.whatsapp_template_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.whatsapp_message_templates(id) ON DELETE SET NULL,
  phone_number VARCHAR(50) NOT NULL,
  customer_id UUID REFERENCES public.distribution_customers(id) ON DELETE SET NULL,
  variables_used JSONB,
  status VARCHAR(50) DEFAULT 'sent',
  error_message TEXT,
  message_id VARCHAR(255),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_template_sends_phone ON whatsapp_template_sends(phone_number, sent_at DESC);
CREATE INDEX idx_template_sends_customer ON whatsapp_template_sends(customer_id, sent_at DESC);

-- Enable RLS
ALTER TABLE public.whatsapp_template_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view template sends"
  ON public.whatsapp_template_sends
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert template sends"
  ON public.whatsapp_template_sends
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert suggested templates (user needs to create these in Meta Business Manager)
INSERT INTO public.whatsapp_message_templates (template_name, meta_template_name, category, purpose, language, preview_text, variables) VALUES
-- Daily order reminders (varied tones)
('order_reminder_friendly', 'dre_order_reminder_1', 'marketing', 'order_reminder', 'en', 
 'Hey {{1}}! 👋 Just checking in - ready to place your order for tomorrow? Fresh produce waiting for you! Reply anytime to get started.',
 '[{"name": "customer_name", "position": 1}]'),

('order_reminder_casual', 'dre_order_reminder_2', 'marketing', 'order_reminder', 'en',
 'Hi {{1}}! 🥬 Haven''t heard from you today - need anything fresh for tomorrow? Just say hi and I''ll help you out!',
 '[{"name": "customer_name", "position": 1}]'),

('order_reminder_professional', 'dre_order_reminder_3', 'marketing', 'order_reminder', 'en',
 'Good day {{1}}, this is Dre from F&B. Would you like to place an order for tomorrow''s delivery? I''m here to assist.',
 '[{"name": "customer_name", "position": 1}]'),

-- Spanish reminders
('order_reminder_spanish_1', 'dre_pedido_1', 'marketing', 'order_reminder', 'es',
 '¡Hola {{1}}! 👋 ¿Listo para hacer tu pedido de mañana? Productos frescos te esperan. ¡Responde cuando quieras!',
 '[{"name": "customer_name", "position": 1}]'),

('order_reminder_spanish_2', 'dre_pedido_2', 'marketing', 'order_reminder', 'es',
 '¡Buenos días {{1}}! 🌿 ¿Necesitas algo fresco para mañana? Estoy aquí para ayudarte con tu pedido.',
 '[{"name": "customer_name", "position": 1}]'),

-- Re-engagement for inactive customers
('reengagement_miss_you', 'dre_miss_you_1', 'marketing', 'reengagement', 'en',
 'Hi {{1}}! 😊 We noticed it''s been a while since your last order. Everything okay? We''d love to have you back - just reply to order!',
 '[{"name": "customer_name", "position": 1}]'),

('reengagement_special', 'dre_special_offer', 'marketing', 'reengagement', 'en',
 'Hey {{1}}! 🌟 We''ve got some great fresh produce this week. Want to check what''s available? Reply and I''ll share our best picks!',
 '[{"name": "customer_name", "position": 1}]'),

-- Weekly specials
('weekly_specials', 'dre_weekly_special', 'marketing', 'promotion', 'en',
 'Hi {{1}}! 📣 Fresh arrivals this week! We have excellent {{2}} available. Interested? Just reply to order!',
 '[{"name": "customer_name", "position": 1}, {"name": "featured_product", "position": 2}]'),

-- Delivery confirmations (utility - higher delivery rate)
('delivery_today', 'dre_delivery_today', 'utility', 'delivery_update', 'en',
 'Hi {{1}}! 🚚 Your order is on its way today. Expected delivery: {{2}}. Any questions? I''m here to help!',
 '[{"name": "customer_name", "position": 1}, {"name": "delivery_time", "position": 2}]'),

('delivery_tomorrow', 'dre_delivery_tomorrow', 'utility', 'delivery_update', 'en',
 'Hi {{1}}! ✅ Your order for tomorrow is confirmed. We''ll deliver around {{2}}. Thanks for ordering with us!',
 '[{"name": "customer_name", "position": 1}, {"name": "delivery_time", "position": 2}]'),

-- Follow-up after delivery
('post_delivery', 'dre_follow_up', 'utility', 'follow_up', 'en',
 'Hi {{1}}! 😊 Hope your delivery arrived well! Let me know if you need anything else or want to place another order.',
 '[{"name": "customer_name", "position": 1}]'),

-- Cutoff reminders
('cutoff_warning', 'dre_cutoff_soon', 'utility', 'cutoff_reminder', 'en',
 'Hi {{1}}! ⏰ Quick heads up - ordering closes in {{2}} for tomorrow''s delivery. Need to add anything? Reply now!',
 '[{"name": "customer_name", "position": 1}, {"name": "time_remaining", "position": 2}]'),

-- Papiamento versions
('order_reminder_pap', 'dre_order_pap_1', 'marketing', 'order_reminder', 'pap',
 '¡Bon dia {{1}}! 👋 ¿Bo ta kier hasi bo order pa mañan? Produktonan fresku ta wardabo! Manda un mensahe ora ku bo ta kla.',
 '[{"name": "customer_name", "position": 1}]');

-- Enable realtime for templates
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_message_templates;