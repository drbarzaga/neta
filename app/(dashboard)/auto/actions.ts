'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, vehicle, vehicleExpense } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { addMonths } from '@/lib/dates';
import {
  createVehicleSchema,
  updateVehicleSchema,
  addVehicleExpenseSchema,
  updateVehicleExpenseSchema,
  deleteVehicleExpenseSchema,
  toggleVehicleExpensePaidSchema,
  contributeDownPaymentSchema,
  LOAN_INSTALLMENT_CATEGORY,
} from './schema';

function revalidate() {
  revalidatePath('/auto');
  revalidatePath('/');
}

export async function createVehicle(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = createVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const data = parsed.data;

  const [v] = await db
    .insert(vehicle)
    .values({
      userId: session.userId,
      name: data.name,
      version: data.version ?? null,
      year: data.year ?? null,
      imageUrl: data.imageUrl ?? null,
      totalPrice: data.totalPrice,
      downPaymentTarget: data.downPaymentTarget,
      downPaymentSaved: data.downPaymentSaved,
      loanAmount: data.loanAmount,
      loanMonths: data.loanMonths,
      loanStartMonth: data.loanStartMonth,
      loanStartYear: data.loanStartYear,
      monthlyPayment: data.monthlyPayment,
      currency: data.currency,
      dollarRate: data.dollarRate,
      color: data.color,
    })
    .returning({ id: vehicle.id });

  // Genera de una las N cuotas del préstamo, una por mes desde el inicio.
  if (data.loanMonths > 0 && data.monthlyPayment > 0) {
    const rows = Array.from({ length: data.loanMonths }, (_, i) => {
      const { month, year } = addMonths(data.loanStartMonth, data.loanStartYear, i);
      return {
        userId: session.userId,
        vehicleId: v.id,
        category: LOAN_INSTALLMENT_CATEGORY,
        concept: `Cuota ${i + 1}/${data.loanMonths}`,
        amount: data.monthlyPayment,
        currency: data.currency,
        month,
        year,
        paid: false,
        sortOrder: i,
      };
    });
    await db.insert(vehicleExpense).values(rows);
  }

  revalidate();
  return ok({ id: v.id });
}

export async function updateVehicle(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = updateVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const { id, ...fields } = parsed.data;

  const result = await db
    .update(vehicle)
    .set(fields)
    .where(and(eq(vehicle.id, id), eq(vehicle.userId, session.userId)))
    .returning({ id: vehicle.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidate();
  return ok();
}

export async function deleteVehicle(id: string): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  await db.delete(vehicle).where(and(eq(vehicle.id, id), eq(vehicle.userId, session.userId)));

  revalidate();
  return ok();
}

/** Abona (o resta, con monto negativo) al ahorro del inicial. No baja de 0. */
export async function contributeDownPayment(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = contributeDownPaymentSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, amount } = parsed.data;
  if (amount === 0) return fail('El monto no puede ser 0');

  const [current] = await db
    .select({ saved: vehicle.downPaymentSaved })
    .from(vehicle)
    .where(and(eq(vehicle.id, id), eq(vehicle.userId, session.userId)));
  if (!current) return UNAUTHORIZED;

  await db
    .update(vehicle)
    .set({ downPaymentSaved: Math.max(0, current.saved + amount) })
    .where(and(eq(vehicle.id, id), eq(vehicle.userId, session.userId)));

  revalidate();
  return ok();
}

export async function addVehicleExpense(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = addVehicleExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const data = parsed.data;

  const [v] = await db
    .select({ id: vehicle.id })
    .from(vehicle)
    .where(and(eq(vehicle.id, data.vehicleId), eq(vehicle.userId, session.userId)));
  if (!v) return fail('Vehículo no encontrado');

  const existing = await db
    .select({ sortOrder: vehicleExpense.sortOrder })
    .from(vehicleExpense)
    .where(eq(vehicleExpense.vehicleId, data.vehicleId));
  const nextOrder = existing.reduce((m, e) => Math.max(m, e.sortOrder), -1) + 1;

  const [e] = await db
    .insert(vehicleExpense)
    .values({
      userId: session.userId,
      vehicleId: data.vehicleId,
      category: data.category,
      concept: data.concept,
      amount: data.amount,
      currency: data.currency,
      month: data.month,
      year: data.year,
      paid: data.paid,
      note: data.note ?? null,
      sortOrder: nextOrder,
    })
    .returning({ id: vehicleExpense.id });

  revalidate();
  return ok({ id: e.id });
}

export async function updateVehicleExpense(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = updateVehicleExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const { id, ...fields } = parsed.data;

  const result = await db
    .update(vehicleExpense)
    .set(fields)
    .where(and(eq(vehicleExpense.id, id), eq(vehicleExpense.userId, session.userId)))
    .returning({ id: vehicleExpense.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidate();
  return ok();
}

export async function toggleVehicleExpensePaid(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = toggleVehicleExpensePaidSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, paid } = parsed.data;

  const result = await db
    .update(vehicleExpense)
    .set({ paid })
    .where(and(eq(vehicleExpense.id, id), eq(vehicleExpense.userId, session.userId)))
    .returning({ id: vehicleExpense.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidate();
  return ok();
}

export async function deleteVehicleExpense(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = deleteVehicleExpenseSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');

  await db
    .delete(vehicleExpense)
    .where(
      and(eq(vehicleExpense.id, parsed.data.id), eq(vehicleExpense.userId, session.userId))
    );

  revalidate();
  return ok();
}
