import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

// Cache de la cotización del dólar (USD -> moneda local) por día y país.
export const exchangeRate = pgTable(
  'exchange_rate',
  {
    id: uuid().primaryKey().defaultRandom(),
    date: date({ mode: 'string' }).notNull(),
    country: text().notNull().default('UY'),
    // Columna física heredada `usd_to_uyu`; hoy guarda USD -> moneda local del país.
    usdRate: numeric('usd_to_uyu', { precision: 14, scale: 4, mode: 'number' }).notNull(),
    source: text().notNull().default('dolarapi'),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [unique().on(t.date, t.country)]
);

export type ExchangeRate = typeof exchangeRate.$inferSelect;
