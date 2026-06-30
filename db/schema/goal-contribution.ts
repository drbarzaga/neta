import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { goal } from './goal';

// Historial de abonos de una meta. Cada abono suma (o corrige) el ahorrado.
export const goalContribution = pgTable('goal_contribution', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  goalId: uuid()
    .notNull()
    .references(() => goal.id, { onDelete: 'cascade' }),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull(),
  note: text(),
  createdAt: timestamp().notNull().defaultNow(),
});

export type GoalContribution = typeof goalContribution.$inferSelect;
