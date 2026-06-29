import { z } from 'zod';

const currencyCode = z.string().trim().toUpperCase().min(3).max(3);

export const addTemplateSchema = z.object({
  concept: z.string().trim().min(1, 'Concepto requerido').max(200),
  categoryId: z.uuid(),
  amount: z.number().min(0).default(0),
  currency: currencyCode.default('UYU'),
});

export const updateTemplateSchema = z.object({
  id: z.uuid(),
  concept: z.string().trim().min(1).max(200).optional(),
  categoryId: z.uuid().optional(),
  amount: z.number().min(0).optional(),
  currency: currencyCode.optional(),
});

export type AddTemplateInput = z.infer<typeof addTemplateSchema>;
