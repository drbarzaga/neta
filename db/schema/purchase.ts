import { pgTable, uuid, text, integer, numeric, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { category } from './category';

// Compra en cuotas: define un plan que genera un gasto ("cuota X/N") en cada uno
// de los N meses a partir del mes de inicio. Los gastos generados apuntan a este
// plan con `purchaseId`; borrar el plan borra sus cuotas (cascade).
export const purchase = pgTable('purchase', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  categoryId: uuid()
    .notNull()
    .references(() => category.id, { onDelete: 'restrict' }),
  concept: text().notNull(),
  currency: text().notNull().default('UYU'),
  installmentAmount: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0), // monto de cada cuota
  installmentsCount: integer().notNull().default(1), // cantidad de cuotas (N)
  startMonth: integer().notNull(), // mes de la primera cuota (1-12)
  startYear: integer().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export type Purchase = typeof purchase.$inferSelect;
