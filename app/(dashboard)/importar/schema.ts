import { z } from 'zod';

export const importRowSchema = z.object({
  categoria: z.string().trim().min(1),
  concepto: z.string().trim().min(1),
  amount: z.number().min(0),
  currency: z.string().trim().toUpperCase().min(3).max(3),
  status: z.enum(['pendiente', 'pagado', 'vencido']),
  dueDate: z.string().nullable(),
});

export const importSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  incomeTotal: z.number().min(0),
  dollarRate: z.number().min(0),
  rows: z.array(importRowSchema).min(1).max(1000),
});

export type ImportInput = z.infer<typeof importSchema>;
