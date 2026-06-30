import { z } from 'zod';

const currencyEnum = z.string().trim().toUpperCase().min(3).max(3);
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .nullable()
  .optional();

const noteField = z.string().trim().max(280).nullable().optional();

export const createGoalSchema = z.object({
  title: z.string().trim().min(1, 'Ponle un nombre a la meta').max(120),
  targetAmount: z.number().min(0).default(0),
  savedAmount: z.number().min(0).default(0),
  currency: currencyEnum.default('UYU'),
  targetDate: dateField,
  note: noteField,
  color: z.string().max(20).default('#10b981'),
});

export const updateGoalSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(120).optional(),
  targetAmount: z.number().min(0).optional(),
  savedAmount: z.number().min(0).optional(),
  currency: currencyEnum.optional(),
  targetDate: dateField,
  note: noteField,
  color: z.string().max(20).optional(),
});

// Abono: monto a sumar al ahorrado (puede ser negativo para corregir).
export const contributeGoalSchema = z.object({
  id: z.uuid(),
  amount: z.number(),
  note: z.string().trim().max(140).nullable().optional(),
});

export const deleteContributionSchema = z.object({
  id: z.uuid(),
});

export const toggleGoalSchema = z.object({
  id: z.uuid(),
  completed: z.boolean(),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
