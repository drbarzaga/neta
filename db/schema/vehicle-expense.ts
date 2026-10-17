import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { vehicle } from './vehicle';

// Gasto mensual de un vehículo: cuota del préstamo (generada automáticamente
// al crear el plan) o un costo libre (seguro, patente, service, combustible…)
// agregado a mano. Se ubica por mes/año en vez de fecha exacta.
export const vehicleExpense = pgTable('vehicle_expense', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  vehicleId: uuid()
    .notNull()
    .references(() => vehicle.id, { onDelete: 'cascade' }),
  category: text().notNull().default('Otro'), // texto libre (Cuota préstamo, Seguro, Patente…)
  concept: text().notNull(),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),
  currency: text().notNull().default('USD'), // ISO-4217 (moneda del vehículo o local)
  month: integer().notNull(), // 1-12
  year: integer().notNull(),
  paid: boolean().notNull().default(false),
  note: text(),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
});

export type VehicleExpense = typeof vehicleExpense.$inferSelect;
