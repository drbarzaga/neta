import { pgTable, uuid, text, integer, boolean } from 'drizzle-orm/pg-core';
import { user } from './auth';

// Preferencias de notificación por correo, una fila por usuario.
export const emailPreference = pgTable('email_preference', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  dueRemindersEnabled: boolean().notNull().default(true),
  dueReminderDaysBefore: integer().notNull().default(3),
  monthlySummaryEnabled: boolean().notNull().default(true),
  budgetAlertEnabled: boolean().notNull().default(true),
  budgetAlertThresholdPct: integer().notNull().default(90),
  lastSummarySentFor: text(), // "2026-03"
});

export type EmailPreference = typeof emailPreference.$inferSelect;
