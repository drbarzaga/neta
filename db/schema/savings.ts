import { pgTable, uuid, text, integer, numeric, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

// Apartado de ahorro (ej. "Caja de ahorro BROU", "Ahorro USD", "Efectivo").
// El saldo (`balance`) se lleva denormalizado y lo ajustan los movimientos.
export const savingsAccount = pgTable('savings_account', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  icon: text().notNull().default('piggy-bank'), // clave de lib/category-icons
  color: text().notNull().default('#10b981'),
  currency: text().notNull().default('UYU'), // ISO-4217 (moneda local o USD)
  balance: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
});

export type SavingsAccount = typeof savingsAccount.$inferSelect;
