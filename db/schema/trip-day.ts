import { pgTable, uuid, text, date, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { trip } from './trip';

// Metadatos de un día puntual del itinerario (tema/título). El día en sí no
// es una fila propia del calendario: se calcula de startDate/endDate del
// viaje; esta tabla solo guarda el título opcional cuando el usuario o la IA
// le ponen uno a un día concreto.
export const tripDay = pgTable(
  'trip_day',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tripId: uuid()
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    date: date({ mode: 'string' }).notNull(),
    title: text(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [unique().on(t.tripId, t.date)]
);

export type TripDay = typeof tripDay.$inferSelect;
