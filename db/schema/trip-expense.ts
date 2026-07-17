import { pgTable, uuid, text, numeric, date, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { trip } from './trip';
import { expense } from './expense';

// Gasto (planeado o pagado) de un viaje. Si `expenseId` está presente, la fila
// es automática (la gestiona un gasto vinculado del mes) y no se edita/borra
// a mano: se sincroniza con `syncExpenseTripExpense` en meses/[id]/actions.ts.
export const tripExpense = pgTable('trip_expense', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  tripId: uuid()
    .notNull()
    .references(() => trip.id, { onDelete: 'cascade' }),
  expenseId: uuid().references(() => expense.id, { onDelete: 'cascade' }),
  category: text().notNull().default('Otro'), // texto libre (Alojamiento, Transporte, Comida…)
  concept: text().notNull(),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),
  currency: text().notNull().default('UYU'), // ISO-4217 (moneda local o USD)
  date: date({ mode: 'string' }),
  time: text(), // hora sugerida "HH:MM" (opcional), para ordenar/mostrar dentro del día
  paid: boolean().notNull().default(false), // false = planeado/estimado, true = ya pagado
  note: text(),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
});

export type TripExpense = typeof tripExpense.$inferSelect;
