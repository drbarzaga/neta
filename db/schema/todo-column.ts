import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

// Columna del tablero Kanban de Todos (ej. "Por hacer", "En progreso", "Hecho").
// Personalizable por el usuario y compartida entre años.
export const todoColumn = pgTable('todo_column', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  color: text().notNull().default('#64748b'),
  // Marca la columna como "logrado": los todos que caen aquí cuentan como
  // completados (fija/limpia su completedAt) para la revisión de fin de año.
  isDone: boolean().notNull().default(false),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
});

export type TodoColumn = typeof todoColumn.$inferSelect;
