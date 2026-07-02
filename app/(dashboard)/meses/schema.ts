import { z } from 'zod';

export const createPeriodSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  incomeTotal: z.number().min(0).default(0),
  cloneFromId: z.uuid().nullable().optional(),
  // Al clonar, pone todos los montos en 0 (mantiene la estructura del mes).
  resetAmounts: z.boolean().optional(),
});

export type CreatePeriodInput = z.infer<typeof createPeriodSchema>;
