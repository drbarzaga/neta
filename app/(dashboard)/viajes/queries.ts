import 'server-only';
import {
  db,
  eq,
  and,
  asc,
  trip,
  tripExpense,
  type Trip,
  type TripExpense,
} from '@/db';
import { tripTotals, type TripTotals } from '@/lib/money';

export interface TripWithTotals extends Trip {
  totals: TripTotals;
}

/** Viajes del usuario con sus totales calculados, por orden y fecha de creación. */
export async function getTrips(userId: string): Promise<TripWithTotals[]> {
  const [trips, expenses] = await Promise.all([
    db
      .select()
      .from(trip)
      .where(eq(trip.userId, userId))
      .orderBy(asc(trip.sortOrder), asc(trip.createdAt)),
    db.select().from(tripExpense).where(eq(tripExpense.userId, userId)),
  ]);

  const byTrip = new Map<string, TripExpense[]>();
  for (const e of expenses) {
    if (!byTrip.has(e.tripId)) byTrip.set(e.tripId, []);
    byTrip.get(e.tripId)!.push(e);
  }

  return trips.map((t) => ({
    ...t,
    totals: tripTotals(byTrip.get(t.id) ?? [], t.dollarRate, t.budget),
  }));
}

/** Un viaje del usuario, o null si no existe / no le pertenece. */
export async function getTrip(userId: string, id: string): Promise<Trip | null> {
  const [row] = await db
    .select()
    .from(trip)
    .where(and(eq(trip.id, id), eq(trip.userId, userId)));
  return row ?? null;
}

/** Gastos de un viaje, más recientes/próximos primero. */
export async function getTripExpenses(
  userId: string,
  tripId: string
): Promise<TripExpense[]> {
  return db
    .select()
    .from(tripExpense)
    .where(and(eq(tripExpense.userId, userId), eq(tripExpense.tripId, tripId)))
    .orderBy(asc(tripExpense.date), asc(tripExpense.sortOrder), asc(tripExpense.createdAt));
}

/** Lista liviana de viajes para el selector de vínculo en el gasto mensual. */
export async function listTripsForLinking(
  userId: string
): Promise<Pick<Trip, 'id' | 'name' | 'icon' | 'color'>[]> {
  return db
    .select({ id: trip.id, name: trip.name, icon: trip.icon, color: trip.color })
    .from(trip)
    .where(eq(trip.userId, userId))
    .orderBy(asc(trip.sortOrder), asc(trip.createdAt));
}
