import { pgTable, uuid, date, numeric, text, timestamp, unique } from 'drizzle-orm/pg-core';

// Cache del valor diario de la Unidad Indexada (UI) de Uruguay, fijada por el
// INE según el IPC (Ley 17.761). Se usa para convertir a pesos las cuotas de
// préstamos indexados a UI (ej. préstamo de auto BBVA).
export const uiValue = pgTable(
  'ui_value',
  {
    id: uuid().primaryKey().defaultRandom(),
    date: date({ mode: 'string' }).notNull(),
    value: numeric({ precision: 10, scale: 4, mode: 'number' }).notNull(),
    source: text().notNull().default('datosuruguay'),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [unique().on(t.date)]
);

export type UiValue = typeof uiValue.$inferSelect;
