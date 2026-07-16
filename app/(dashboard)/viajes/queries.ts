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
import { tripTotals, type TripTotals, type DestinationRate } from '@/lib/money';
import { getCountry } from '@/lib/countries';
import { getLatestRate } from '@/lib/exchange-rate';

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

  // Cotización de cada país de destino en juego (una consulta por país, no por viaje).
  const countryCodes = [...new Set(trips.map((t) => t.destinationCountry).filter((c): c is string => !!c))];
  const rateByCountry = new Map(
    await Promise.all(countryCodes.map(async (c) => [c, await getLatestRate(c)] as const))
  );

  return trips.map((t) => {
    const dest: DestinationRate | null = t.destinationCountry
      ? { currency: getCountry(t.destinationCountry).currency, rate: rateByCountry.get(t.destinationCountry) ?? 0 }
      : null;
    return {
      ...t,
      totals: tripTotals(byTrip.get(t.id) ?? [], t.currency, t.dollarRate, t.budget, dest),
    };
  });
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
