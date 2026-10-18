import { pgTable, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { todo } from './todo';

// Ítem individual de la lista de verificación dentro de un todo (ej. las
// cuotas de un plan de ahorro, los pasos de una tarea). Opcional: un todo
// puede no tener ninguno.
export const todoItem = pgTable('todo_item', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  todoId: uuid()
    .notNull()
    .references(() => todo.id, { onDelete: 'cascade' }),
  text: text().notNull(),
  checked: boolean().notNull().default(false),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
});

export type TodoItem = typeof todoItem.$inferSelect;
