import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

// Historial de la conversación con el asesor financiero. Una sola conversación
// continua por usuario; "Nueva conversación" borra todos sus mensajes.
export const advisorMessage = pgTable('advisor_message', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text().notNull(), // 'user' | 'assistant'
  content: text().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export type AdvisorMessageRow = typeof advisorMessage.$inferSelect;
