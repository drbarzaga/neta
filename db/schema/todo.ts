import { pgTable, uuid, text, integer, date, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { todoColumn } from './todo-column';

// Un propósito/tarea del año, ubicada en una columna del Kanban de Todos.
export const todo = pgTable('todo', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  columnId: uuid()
    .notNull()
    .references(() => todoColumn.id, { onDelete: 'restrict' }),
  year: integer().notNull(),
  title: text().notNull(),
  note: text(),
  dueDate: date({ mode: 'string' }),
  // Se fija/limpia automáticamente al mover el todo hacia/fuera de una
  // columna con isDone=true (ver actions.ts).
  completedAt: timestamp(),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
});

export type Todo = typeof todo.$inferSelect;
