import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  unique,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

export const periodStatus = pgEnum('period_status', ['open', 'closed']);

// Un mes presupuestario (equivale a una pestaña del Google Sheet).
export const period = pgTable(
  'period',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    label: text().notNull(), // "Marzo de 2026"
    year: integer().notNull(),
    month: integer().notNull(), // 1-12
    incomeTotal: numeric({ precision: 14, scale: 2, mode: 'number' })
      .notNull()
      .default(0),
    localCurrency: text().notNull().default('UYU'), // moneda local del mes (snapshot)
    dollarRate: numeric({ precision: 14, scale: 4, mode: 'number' })
      .notNull()
      .default(0), // USD -> moneda local

    status: periodStatus().notNull().default('open'),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.year, t.month)]
);

export type Period = typeof period.$inferSelect;
