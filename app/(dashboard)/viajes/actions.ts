'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, trip, tripExpense } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import {
  createTripSchema,
  updateTripSchema,
  addTripExpenseSchema,
  updateTripExpenseSchema,
  deleteTripExpenseSchema,
  toggleTripExpensePaidSchema,
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

  const [t] = await db
    .insert(trip)
    .values({
      userId: session.userId,
      name: data.name,
      destination: data.destination ?? null,
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

  const result = await db
    .update(trip)
    .set(fields)
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
