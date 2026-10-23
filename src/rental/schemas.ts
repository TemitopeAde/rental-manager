import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');

export const quoteSchema = z.object({
  itemId: z.string().min(1),
  startDate: date,
  endDate: date,
  quantity: z.coerce.number().int().min(1).default(1),
});

export const holdSchema = quoteSchema.extend({
  idempotencyKey: z.string().min(8),
});

export const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  slug: z.string().optional(),
  unitCount: z.coerce.number().int().min(1).default(1),
  dailyRate: z.coerce.number().positive(),
  weeklyRate: z.coerce.number().min(0).default(0),
  depositAmount: z.coerce.number().min(0).default(0),
  minDays: z.coerce.number().int().min(1).default(1),
  maxDays: z.coerce.number().int().min(1).default(30),
  bufferDays: z.coerce.number().int().min(0).default(0),
  leadDays: z.coerce.number().int().min(0).default(1),
  status: z.enum(['active', 'hidden', 'archived']).default('active'),
  storeProductId: z.string().optional(),
  storeRentalOverride: z.enum(['inherit', 'enabled', 'disabled']).default('inherit'),
});
