'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, isNull, trip, tripExpense } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { resolveDestinationImage } from '@/lib/destination-image';
import { generateTripSuggestions, serverApiKey, type TripSuggestion } from '@/lib/ai';
import { getUserAiConfig } from '../configuracion/queries';
import { getCountry } from '@/lib/countries';
import {
  createTripSchema,
  updateTripSchema,
  addTripExpenseSchema,
  updateTripExpenseSchema,
  deleteTripExpenseSchema,
  toggleTripExpensePaidSchema,
  moveTripExpenseDaySchema,
} from './schema';

function revalidate(id?: string) {
  revalidatePath('/viajes');
  revalidatePath('/');
  if (id) revalidatePath(`/viajes/${id}`);
}

export async function createTrip(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = createTripSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const data = parsed.data;

  const existing = await db
    .select({ sortOrder: trip.sortOrder })
    .from(trip)
    .where(eq(trip.userId, session.userId));
  const nextOrder = existing.reduce((m, t) => Math.max(m, t.sortOrder), -1) + 1;

  // Foto del destino: mejor esfuerzo (Wikipedia), no bloquea si falla.
  const destinationImageUrl = data.destination
    ? await resolveDestinationImage(data.destination)
    : null;

  const [t] = await db
    .insert(trip)
    .values({
      userId: session.userId,
      name: data.name,
      destination: data.destination ?? null,
      destinationImageUrl,
      destinationCountry: data.destinationCountry ?? null,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      currency: data.currency,
      dollarRate: data.dollarRate,
      budget: data.budget,
      icon: data.icon,
      color: data.color,
      sortOrder: nextOrder,
    })
    .returning({ id: trip.id });

  revalidate();
  return ok({ id: t.id });
}

export async function updateTrip(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = updateTripSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const { id, ...fields } = parsed.data;

  // Si cambió el destino, re-resuelve su foto (mejor esfuerzo); si no, la deja.
  let destinationImageUrl: string | null | undefined;
  if (fields.destination !== undefined) {
    const [current] = await db
      .select({ destination: trip.destination })
      .from(trip)
      .where(and(eq(trip.id, id), eq(trip.userId, session.userId)));
    if (!current) return UNAUTHORIZED;
    if (fields.destination !== current.destination) {
      destinationImageUrl = fields.destination
        ? await resolveDestinationImage(fields.destination)
        : null;
    }
  }

  const result = await db
    .update(trip)
    .set({
      ...fields,
      ...(destinationImageUrl !== undefined && { destinationImageUrl }),
    })
    .where(and(eq(trip.id, id), eq(trip.userId, session.userId)))
    .returning({ id: trip.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidate(id);
  return ok();
}

export async function deleteTrip(id: string): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  await db.delete(trip).where(and(eq(trip.id, id), eq(trip.userId, session.userId)));

  revalidate();
  return ok();
}

export async function addTripExpense(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = addTripExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const data = parsed.data;

  const [t] = await db
    .select({ id: trip.id })
    .from(trip)
    .where(and(eq(trip.id, data.tripId), eq(trip.userId, session.userId)));
  if (!t) return fail('Viaje no encontrado');

  const existing = await db
    .select({ sortOrder: tripExpense.sortOrder })
    .from(tripExpense)
    .where(eq(tripExpense.tripId, data.tripId));
  const nextOrder = existing.reduce((m, e) => Math.max(m, e.sortOrder), -1) + 1;

  const [e] = await db
    .insert(tripExpense)
    .values({
      userId: session.userId,
      tripId: data.tripId,
      category: data.category,
      concept: data.concept,
      amount: data.amount,
      currency: data.currency,
      date: data.date ?? null,
      paid: data.paid,
      note: data.note ?? null,
      sortOrder: nextOrder,
    })
    .returning({ id: tripExpense.id });

  revalidate(data.tripId);
  return ok({ id: e.id });
}

/** Solo edita filas independientes (sin gasto del mes vinculado). */
export async function updateTripExpense(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = updateTripExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const { id, ...fields } = parsed.data;

  const [current] = await db
    .select({ tripId: tripExpense.tripId, expenseId: tripExpense.expenseId })
    .from(tripExpense)
    .where(and(eq(tripExpense.id, id), eq(tripExpense.userId, session.userId)));
  if (!current) return UNAUTHORIZED;
  if (current.expenseId) {
    return fail('Este gasto viene de un gasto vinculado; edítalo desde el mes.');
  }

  await db
    .update(tripExpense)
    .set(fields)
    .where(and(eq(tripExpense.id, id), eq(tripExpense.userId, session.userId)));

  revalidate(current.tripId);
  return ok();
}

export async function toggleTripExpensePaid(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = toggleTripExpensePaidSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, paid } = parsed.data;

  const [current] = await db
    .select({ tripId: tripExpense.tripId, expenseId: tripExpense.expenseId })
    .from(tripExpense)
    .where(and(eq(tripExpense.id, id), eq(tripExpense.userId, session.userId)));
  if (!current) return UNAUTHORIZED;
  if (current.expenseId) {
    return fail('Este gasto viene de un gasto vinculado; edítalo desde el mes.');
  }

  await db
    .update(tripExpense)
    .set({ paid })
    .where(and(eq(tripExpense.id, id), eq(tripExpense.userId, session.userId)));

  revalidate(current.tripId);
  return ok();
}

/**
 * Mueve un gasto de viaje a un día del itinerario (drag & drop). `date: null`
 * lo manda a "sin día asignado". Además fija el orden dentro del día destino
 * según `orderedIds`. Solo aplica a filas independientes (sin gasto del mes
 * vinculado, que no se pueden reprogramar desde acá).
 */
export async function moveTripExpenseDay(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = moveTripExpenseDaySchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, tripId, date, orderedIds } = parsed.data;

  const [current] = await db
    .select({ expenseId: tripExpense.expenseId })
    .from(tripExpense)
    .where(and(eq(tripExpense.id, id), eq(tripExpense.userId, session.userId), eq(tripExpense.tripId, tripId)));
  if (!current) return UNAUTHORIZED;
  if (current.expenseId) {
    return fail('Este gasto viene de un gasto vinculado; edítalo desde el mes.');
  }

  const moved = await db
    .update(tripExpense)
    .set({ date })
    .where(and(eq(tripExpense.id, id), eq(tripExpense.userId, session.userId)))
    .returning({ id: tripExpense.id });
  if (moved.length === 0) return UNAUTHORIZED;

  // Reordena el día destino según orderedIds (solo ids que ya están ahí).
  const owned = await db
    .select({ id: tripExpense.id })
    .from(tripExpense)
    .where(
      and(
        eq(tripExpense.userId, session.userId),
        eq(tripExpense.tripId, tripId),
        date === null ? isNull(tripExpense.date) : eq(tripExpense.date, date)
      )
    );
  const valid = new Set(owned.map((e) => e.id));

  let order = 0;
  for (const eid of orderedIds) {
    if (!valid.has(eid)) continue;
    await db
      .update(tripExpense)
      .set({ sortOrder: order++ })
      .where(and(eq(tripExpense.id, eid), eq(tripExpense.userId, session.userId)));
  }

  revalidate(tripId);
  return ok();
}

/** Solo borra filas independientes (sin gasto del mes vinculado). */
export async function deleteTripExpense(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = deleteTripExpenseSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');

  const [current] = await db
    .select({ tripId: tripExpense.tripId, expenseId: tripExpense.expenseId })
    .from(tripExpense)
    .where(and(eq(tripExpense.id, parsed.data.id), eq(tripExpense.userId, session.userId)));
  if (!current) return UNAUTHORIZED;
  if (current.expenseId) {
    return fail('Este gasto viene de un gasto vinculado; edítalo desde el mes.');
  }

  await db.delete(tripExpense).where(eq(tripExpense.id, parsed.data.id));

  revalidate(current.tripId);
  return ok();
}

/**
 * Sugerencias de itinerario con IA (lugares/actividades/comidas) para el
 * destino del viaje. `excludeTitles` son sugerencias ya mostradas en esta
 * sesión (para "Generar otras"); se suman a los gastos que ya tiene el viaje
 * para que la IA no repita nada de lo que el usuario ya ve.
 */
export async function getTripSuggestions(
  tripId: string,
  excludeTitles: string[] = []
): Promise<ActionResult<TripSuggestion[]>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const [t] = await db
    .select({ destination: trip.destination, destinationCountry: trip.destinationCountry })
    .from(trip)
    .where(and(eq(trip.id, tripId), eq(trip.userId, session.userId)));
  if (!t) return UNAUTHORIZED;
  if (!t.destination) return fail('Define primero un destino para el viaje.');

  const existing = await db
    .select({ concept: tripExpense.concept })
    .from(tripExpense)
    .where(and(eq(tripExpense.userId, session.userId), eq(tripExpense.tripId, tripId)));

  const exclude = [...new Set([...existing.map((e) => e.concept), ...excludeTitles])];

  const userAi = await getUserAiConfig(session.userId);
  const apiKey = userAi.key ?? serverApiKey;
  if (!apiKey) {
    return fail(
      'Configura tu API key (Anthropic u OpenRouter) en Configuración para usar esta función.'
    );
  }

  try {
    const suggestions = await generateTripSuggestions({
      apiKey,
      model: userAi.model,
      destination: t.destination,
      destinationCountryName: t.destinationCountry ? getCountry(t.destinationCountry).name : null,
      exclude,
    });
    // Red de seguridad por si el modelo repite algo pese a la instrucción,
    // ya sea contra lo excluido o duplicado dentro de la misma respuesta.
    const excludeNorm = new Set(exclude.map((s) => s.trim().toLowerCase()));
    const seen = new Set<string>();
    const filtered = suggestions.filter((s) => {
      const key = s.title.trim().toLowerCase();
      if (excludeNorm.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (filtered.length === 0) {
      return fail('No se pudieron generar sugerencias nuevas. Intenta de nuevo.');
    }
    return ok(filtered);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'No se pudieron generar sugerencias.');
  }
}
