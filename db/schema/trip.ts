import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  integer,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

export const tripStatus = pgEnum('trip_status', [
  'planificando',
  'en_curso',
  'completado',
]);

// Viaje planificado por el usuario. No pertenece a ningún período, así que
// lleva su propia cotización (`dollarRate`) para totalizar gastos en USD.
export const trip = pgTable('trip', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  destination: text(),
  // Foto circular del destino (URL pública), resuelta best-effort desde
  // Wikipedia al crear/editar el viaje. Null si no se encontró o falló.
  destinationImageUrl: text(),
  startDate: date({ mode: 'string' }),
  endDate: date({ mode: 'string' }),
  currency: text().notNull().default('UYU'), // ISO-4217 (moneda local o USD)
  dollarRate: numeric({ precision: 14, scale: 4, mode: 'number' })
    .notNull()
    .default(0),
  budget: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0), // 0 = sin presupuesto definido
  status: tripStatus().notNull().default('planificando'),
  icon: text().notNull().default('plane'), // clave de lib/category-icons
  color: text().notNull().default('#0ea5e9'),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
});

export type Trip = typeof trip.$inferSelect;
