import { z } from 'zod';

const currencyEnum = z.string().trim().toUpperCase().min(3).max(3);
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .nullable()
  .optional();

// Sugerencias de categoría para gastos de viaje (texto libre, no una tabla).
export const TRIP_EXPENSE_CATEGORIES = [
  'Alojamiento',
  'Transporte',
  'Comida',
  'Actividades',
  'Compras',
  'Otro',
] as const;

export const tripStatusEnum = z.enum(['planificando', 'en_curso', 'completado']);

export const TRIP_STATUS_LABEL: Record<z.infer<typeof tripStatusEnum>, string> = {
  planificando: 'Planificando',
  en_curso: 'En curso',
  completado: 'Completado',
};

export const createTripSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre al viaje').max(120),
  destination: z.string().trim().max(120).nullable().optional(),
  startDate: dateField,
  endDate: dateField,
  currency: currencyEnum.default('UYU'),
  dollarRate: z.number().min(0).default(0),
  budget: z.number().min(0).default(0),
  icon: z.string().min(1).max(40).default('plane'),
  color: z.string().max(20).default('#0ea5e9'),
});

export const updateTripSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  destination: z.string().trim().max(120).nullable().optional(),
  startDate: dateField,
  endDate: dateField,
  currency: currencyEnum.optional(),
  dollarRate: z.number().min(0).optional(),
  budget: z.number().min(0).optional(),
  status: tripStatusEnum.optional(),
  icon: z.string().min(1).max(40).optional(),
  color: z.string().max(20).optional(),
});

export const addTripExpenseSchema = z.object({
  tripId: z.uuid(),
  category: z.string().trim().min(1).max(40).default('Otro'),
  concept: z.string().trim().min(1, 'Concepto requerido').max(200),
  amount: z.number().min(0).default(0),
  currency: currencyEnum.default('UYU'),
  date: dateField,
  paid: z.boolean().default(false),
  note: z.string().trim().max(280).nullable().optional(),
});

export const updateTripExpenseSchema = z.object({
  id: z.uuid(),
  category: z.string().trim().min(1).max(40).optional(),
  concept: z.string().trim().min(1).max(200).optional(),
  amount: z.number().min(0).optional(),
  currency: currencyEnum.optional(),
  date: dateField,
  paid: z.boolean().optional(),
  note: z.string().trim().max(280).nullable().optional(),
});

export const deleteTripExpenseSchema = z.object({
  id: z.uuid(),
});

export const toggleTripExpensePaidSchema = z.object({
  id: z.uuid(),
  paid: z.boolean(),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
