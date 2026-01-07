import { z } from 'zod';

export const webhookSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  
  url: z
    .string()
    .trim()
    .url('Invalid URL format')
    .max(500, 'URL must be less than 500 characters'),
  
  events: z
    .array(z.string())
    .min(1, 'Select at least one event'),
  
  secret_key: z
    .string()
    .min(16, 'Secret key must be at least 16 characters')
    .max(128, 'Secret key must be less than 128 characters')
    .optional()
    .nullable(),
  
  is_active: z.boolean().default(true),
  
  headers: z
    .record(z.string())
    .optional()
    .nullable(),
  
  retry_count: z
    .number()
    .min(0)
    .max(5)
    .default(3),
});

export type WebhookFormData = z.infer<typeof webhookSchema>;

export const integrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  
  type: z.enum(['whatsapp', 'quickbooks', 'zapier', 'custom']),
  
  is_active: z.boolean().default(false),
  
  config: z.record(z.unknown()).default({}),
});

export type IntegrationFormData = z.infer<typeof integrationSchema>;

// WhatsApp specific config
export const whatsappConfigSchema = z.object({
  phone_number_id: z.string().min(1, 'Phone Number ID is required'),
  business_account_id: z.string().min(1, 'Business Account ID is required'),
  webhook_verify_token: z.string().min(8, 'Verify token must be at least 8 characters'),
  auto_reply_enabled: z.boolean().default(true),
  order_confirmation_enabled: z.boolean().default(true),
});

export type WhatsAppConfigFormData = z.infer<typeof whatsappConfigSchema>;
