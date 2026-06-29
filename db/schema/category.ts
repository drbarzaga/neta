import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

// Categorías recurrentes por usuario (PAGARTE PRIMERO, TARJETAS, GASTOS FIJOS, VARIABLES...).
export const category = pgTable('category', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  color: text().notNull().default('#64748b'),
  icon: text().notNull().default('tag'),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
});

export type Category = typeof category.$inferSelect;
