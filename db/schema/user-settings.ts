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
  // API key del usuario (BYOK) para el asesor, cifrada en reposo. Puede ser de
  // Anthropic (sk-ant-…) o de OpenRouter (sk-or-…); el proveedor se detecta por
  // el prefijo. Nunca se devuelve al cliente; solo si está configurada o no.
  anthropicApiKey: text(),
  // Modelo a usar con OpenRouter (ej. "anthropic/claude-sonnet-4.5"). Se ignora
  // con keys de Anthropic (allí se usa Claude directamente).
  aiModel: text(),
});

export type UserSettings = typeof userSettings.$inferSelect;
