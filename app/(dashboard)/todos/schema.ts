import { z } from 'zod';

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .nullable()
  .optional();

const noteField = z.string().trim().max(280).nullable().optional();

export const createColumnSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre a la columna').max(60),
  color: z.string().max(20).default('#64748b'),
  isDone: z.boolean().default(false),
});

export const updateColumnSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(60).optional(),
  color: z.string().max(20).optional(),
  isDone: z.boolean().optional(),
});

export const reorderColumnsSchema = z.object({
  orderedIds: z.array(z.uuid()),
});

export const createTodoSchema = z.object({
  columnId: z.uuid(),
  year: z.number().int().min(2000).max(3000),
  title: z.string().trim().min(1, 'Ponle un título a la tarea').max(160),
  note: noteField,
  dueDate: dateField,
});

export const updateTodoSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(160).optional(),
  note: noteField,
  dueDate: dateField,
});

// Mueve un todo a `columnId` (puede ser la misma) y fija el orden final de esa
// columna (mismo patrón que moveExpense en meses/[id]).
export const moveTodoSchema = z.object({
  id: z.uuid(),
  columnId: z.uuid(),
  orderedIds: z.array(z.uuid()),
});

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
