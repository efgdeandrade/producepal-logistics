import { z } from 'zod';

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Product name is required')
    .max(100, 'Name must be less than 100 characters'),
  
  sku: z
    .string()
    .trim()
    .min(1, 'SKU is required')
    .max(50, 'SKU must be less than 50 characters')
    .regex(/^[A-Za-z0-9-_]+$/, 'SKU can only contain letters, numbers, hyphens, and underscores'),
  
  category: z
    .string()
    .max(50, 'Category must be less than 50 characters')
    .optional()
    .nullable(),
  
  unit: z
    .string()
    .min(1, 'Unit is required')
    .max(20, 'Unit must be less than 20 characters'),
  
  base_price_xcg: z
    .number()
    .min(0, 'Price cannot be negative'),
  
  cost_price_xcg: z
    .number()
    .min(0, 'Cost cannot be negative')
    .optional()
    .nullable(),
  
  weight_kg: z
    .number()
    .min(0, 'Weight cannot be negative')
    .optional()
    .nullable(),
  
  is_active: z.boolean().default(true),
  
  is_weighted: z.boolean().default(false),
  
  min_order_quantity: z
    .number()
    .min(0, 'Minimum quantity cannot be negative')
    .optional()
    .nullable(),
  
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .nullable(),
});

export type ProductFormData = z.infer<typeof productSchema>;

export const productUpdateSchema = productSchema.partial();
