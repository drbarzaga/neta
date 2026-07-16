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
import { purchase } from './purchase';
import { savingsAccount } from './savings';
import { trip } from './trip';

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
  // Apartado de ahorro vinculado (opcional): al pagarse deposita en ese apartado.
  savingsAccountId: uuid().references(() => savingsAccount.id, {
    onDelete: 'set null',
  }),
  // Viaje vinculado (opcional): es una etiqueta de pertenencia, no un destino
  // de dinero, así que convive con goalId/savingsAccountId sin excluirlos.
  tripId: uuid().references(() => trip.id, { onDelete: 'set null' }),
  // Recurrente: se agrega solo a cada mes nuevo (copiado del último mes previo).
  recurring: boolean().notNull().default(false),
  // Compra en cuotas (opcional): plan al que pertenece y número de cuota (X de N).
  purchaseId: uuid().references(() => purchase.id, { onDelete: 'cascade' }),
  installmentNumber: integer(), // 1..N
  installmentsCount: integer(), // N (denormalizado para mostrar "X/N")
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
});

export type Expense = typeof expense.$inferSelect;
