import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  boolean,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

// Metas de ahorro del usuario (inicial del auto, casa, viaje…). El progreso se
// lleva de forma manual con `savedAmount` (abonos), independiente del presupuesto.
export const goal = pgTable('goal', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  targetAmount: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),
  savedAmount: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),
  currency: text().notNull().default('UYU'), // ISO-4217 (moneda local o USD)
  targetDate: date({ mode: 'string' }), // fecha objetivo, opcional
  note: text(), // descripción / notas libres, opcional
  color: text().notNull().default('#10b981'),
  completed: boolean().notNull().default(false),
  completedAt: timestamp(),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
});

export type Goal = typeof goal.$inferSelect;
