import { pgTable, uuid, text, boolean } from 'drizzle-orm/pg-core';
import { user } from './auth';

// Ajustes de región/moneda por usuario, una fila por usuario.
export const userSettings = pgTable('user_settings', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  country: text().notNull().default('UY'), // código del catálogo lib/countries
  arCasa: text().notNull().default('blue'), // casa de dólar usada en Argentina
  displayCurrency: text().notNull().default('local'), // 'local' | 'usd'
  animationsEnabled: boolean().notNull().default(false), // animaciones de UI (off por defecto)
});

export type UserSettings = typeof userSettings.$inferSelect;
