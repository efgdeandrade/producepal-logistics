import { z } from 'zod';

const orderItemSchema = z.object({
  product_id: z.string().uuid('Invalid product'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  unit_price_xcg: z.number().min(0, 'Price cannot be negative'),
  order_unit: z.string().optional(),
});

export const orderSchema = z.object({
  customer_id: z.string().uuid('Please select a customer'),
  
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  
  delivery_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .optional()
    .nullable(),
  
  items: z
    .array(orderItemSchema)
    .min(1, 'Order must have at least one item'),
  
  payment_method: z
    .enum(['cash', 'credit', 'bank_transfer', 'pos'])
    .optional()
    .nullable(),
  
  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .optional()
    .nullable(),
  
  po_number: z
    .string()
    .max(50, 'PO number must be less than 50 characters')
    .optional()
    .nullable(),
  
  is_pickup: z.boolean().default(false),
  
  priority: z.number().min(0).max(10).default(5),
});

export type OrderFormData = z.infer<typeof orderSchema>;
export type OrderItemFormData = z.infer<typeof orderItemSchema>;

// Quick order validation (simplified)
export const quickOrderSchema = z.object({
  customer_id: z.string().uuid('Please select a customer'),
  items: z.array(orderItemSchema).min(1, 'Add at least one item'),
});
