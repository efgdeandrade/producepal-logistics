import { z } from 'zod';

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  
  whatsapp_phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  
  address: z
    .string()
    .trim()
    .max(255, 'Address must be less than 255 characters')
    .optional()
    .nullable(),
  
  delivery_zone: z
    .string()
    .max(100, 'Zone must be less than 100 characters')
    .optional()
    .nullable(),
  
  customer_type: z
    .enum(['retail', 'wholesale', 'supermarket', 'restaurant', 'hotel'])
    .default('retail'),
  
  preferred_language: z
    .enum(['en', 'es', 'fr', 'nl', 'pap'])
    .default('en'),
  
  preferred_payment_method: z
    .enum(['cash', 'credit', 'bank_transfer', 'pos'])
    .optional()
    .nullable(),
  
  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .optional()
    .nullable(),
  
  pricing_tier_id: z.string().uuid().optional().nullable(),
  major_zone_id: z.string().uuid().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

// For updates where all fields are optional
export const customerUpdateSchema = customerSchema.partial();
