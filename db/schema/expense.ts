import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  date,
  timestamp,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { period } from './period';
import { category } from './category';
import { goal } from './goal';

export const expenseStatus = pgEnum('expense_status', [
  'pendiente',
  'pagado',
  'vencido',
]);

// Una línea de gasto dentro de un mes (fila de la tabla del sheet).
export const expense = pgTable('expense', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  periodId: uuid()
    .notNull()
    .references(() => period.id, { onDelete: 'cascade' }),
  categoryId: uuid()
    .notNull()
    .references(() => category.id, { onDelete: 'restrict' }),
  concept: text().notNull(),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),
  currency: text().notNull().default('UYU'), // código ISO-4217 (moneda local o USD)
  status: expenseStatus().notNull().default('pendiente'),
  dueDate: date({ mode: 'string' }),
  // Meta vinculada (opcional): al marcarse "pagado" aporta a esa meta.
  goalId: uuid().references(() => goal.id, { onDelete: 'set null' }),
  // Recurrente: se agrega solo a cada mes nuevo (copiado del último mes previo).
  recurring: boolean().notNull().default(false),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
});

export type Expense = typeof expense.$inferSelect;
