import { z } from 'zod';

// Código ISO-4217 de moneda (local del país o 'USD').
export const currencyEnum = z.string().trim().toUpperCase().min(3).max(3);
export const statusEnum = z.enum(['pendiente', 'pagado', 'vencido']);

export const addExpenseSchema = z.object({
  periodId: z.uuid(),
  categoryId: z.uuid(),
  concept: z.string().trim().min(1, 'Concepto requerido').max(200),
  amount: z.number().min(0).default(0),
  currency: currencyEnum.default('UYU'),
});

export const updateExpenseSchema = z.object({
  id: z.uuid(),
  concept: z.string().trim().min(1).max(200).optional(),
  amount: z.number().min(0).optional(),
  currency: currencyEnum.optional(),
  status: statusEnum.optional(),
  dueDate: z.string().nullable().optional(),
});

export const periodHeaderSchema = z.object({
  id: z.uuid(),
  incomeTotal: z.number().min(0),
  dollarRate: z.number().min(0),
});

export type AddExpenseInput = z.infer<typeof addExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type PeriodHeaderInput = z.infer<typeof periodHeaderSchema>;
