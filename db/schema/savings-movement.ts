import { pgTable, uuid, text, numeric, date, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { savingsAccount } from './savings';
import { expense } from './expense';

// Movimiento de un apartado: monto con signo (+ depósito, − retiro).
// Si `expenseId` está presente, el movimiento es automático (lo gestiona un
// gasto vinculado y pagado) y no se edita/borra a mano.
export const savingsMovement = pgTable('savings_movement', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: uuid()
    .notNull()
    .references(() => savingsAccount.id, { onDelete: 'cascade' }),
  expenseId: uuid().references(() => expense.id, { onDelete: 'cascade' }),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull(),
  note: text(),
  date: date({ mode: 'string' }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export type SavingsMovement = typeof savingsMovement.$inferSelect;
