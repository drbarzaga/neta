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
  recurring: z.boolean().optional(),
});

export const periodHeaderSchema = z.object({
  id: z.uuid(),
  incomeTotal: z.number().min(0),
  dollarRate: z.number().min(0),
});

// Ajuste manual de la cotización del dólar del mes.
export const setDollarRateSchema = z.object({
  id: z.uuid(),
  dollarRate: z.number().min(0, 'La cotización no puede ser negativa'),
});

// Reordenar gastos dentro de una categoría: lista de ids en el nuevo orden.
export const reorderExpensesSchema = z.object({
  periodId: z.uuid(),
  categoryId: z.uuid(),
  orderedIds: z.array(z.uuid()).min(1),
});

// Vincular (o desvincular con null) un gasto a una meta.
export const setExpenseGoalSchema = z.object({
  id: z.uuid(),
  goalId: z.uuid().nullable(),
});

// Mover un gasto a otra categoría (o reordenar dentro de la misma) y fijar el
// orden de la categoría destino con la lista de ids.
export const moveExpenseSchema = z.object({
  id: z.uuid(),
  periodId: z.uuid(),
  toCategoryId: z.uuid(),
  orderedIds: z.array(z.uuid()).min(1),
});

// Mover (posponer/adelantar) un gasto a otro mes; opcionalmente reinicia el
// estado a pendiente (típico al posponer algo que no se pudo pagar).
export const moveExpenseToPeriodSchema = z.object({
  id: z.uuid(),
  toPeriodId: z.uuid(),
  resetStatus: z.boolean().optional(),
});

export type AddExpenseInput = z.infer<typeof addExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type PeriodHeaderInput = z.infer<typeof periodHeaderSchema>;
