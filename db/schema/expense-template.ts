import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { category } from './category';

// Ítem reutilizable: un concepto recurrente (ej. "BROU USD", "Alquiler") que se
// puede insertar rápidamente en cualquier mes.
export const expenseTemplate = pgTable('expense_template', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  categoryId: uuid()
    .notNull()
    .references(() => category.id, { onDelete: 'cascade' }),
  concept: text().notNull(),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),
  currency: text().notNull().default('UYU'), // código ISO-4217 (moneda local o USD)
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
});

export type ExpenseTemplate = typeof expenseTemplate.$inferSelect;
