'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, vehicle, vehicleExpense } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { addMonths, resolveSalaryDepositDay, daysInMonth } from '@/lib/dates';
import { getLatestUiValue } from '@/lib/ui-value';
import { recalculateUiInstallments } from '@/lib/vehicle-ui-loan';
import {
  createVehicleSchema,
  updateVehicleSchema,
  addVehicleExpenseSchema,
  updateVehicleExpenseSchema,
  deleteVehicleExpenseSchema,
  toggleVehicleExpensePaidSchema,
  contributeDownPaymentSchema,
  payOffLoanSchema,
  onboardingVehicleSchema,
  createUiLoanSchema,
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
      monthlyPaymentCurrency: data.monthlyPaymentCurrency,
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
        currency: data.monthlyPaymentCurrency,
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

/**
 * Alta guiada de un vehículo: crea el vehículo y precarga de una las cuotas
 * del préstamo, el seguro mensual (mismo rango que el préstamo), la
 * matrícula (pago único en el mes de inicio) y, si se aceptó, el pack de
 * seguridad diferido al mes siguiente en cuotas.
 */
export async function completeVehicleOnboarding(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = onboardingVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const data = parsed.data;
  const totalPrice = data.downPaymentGiven + data.loanAmount;

  const [v] = await db
    .insert(vehicle)
    .values({
      userId: session.userId,
      name: data.name,
      version: data.version ?? null,
      year: data.year ?? null,
      totalPrice,
      downPaymentTarget: data.downPaymentGiven,
      downPaymentSaved: data.downPaymentGiven,
      loanAmount: data.loanAmount,
      loanMonths: data.loanMonths,
      loanStartMonth: data.loanStartMonth,
      loanStartYear: data.loanStartYear,
      monthlyPayment: data.monthlyPayment,
      currency: 'USD',
      monthlyPaymentCurrency: data.monthlyPaymentCurrency,
      dollarRate: data.dollarRate,
      status: 'financiando',
    })
    .returning({ id: vehicle.id });

  const rows: (typeof vehicleExpense.$inferInsert)[] = [];
  let sortOrder = 0;

  for (let i = 0; i < data.loanMonths; i++) {
    const { month, year } = addMonths(data.loanStartMonth, data.loanStartYear, i);
    rows.push({
      userId: session.userId,
      vehicleId: v.id,
      category: LOAN_INSTALLMENT_CATEGORY,
      concept: `Cuota ${i + 1}/${data.loanMonths}`,
      amount: data.monthlyPayment,
      currency: data.monthlyPaymentCurrency,
      month,
      year,
      paid: false,
      sortOrder: sortOrder++,
    });
  }

  if (data.insuranceMonthly > 0) {
    for (let i = 0; i < data.loanMonths; i++) {
      const { month, year } = addMonths(data.loanStartMonth, data.loanStartYear, i);
      rows.push({
        userId: session.userId,
        vehicleId: v.id,
        category: 'Seguro',
        concept: 'Seguro BSE (convenio automotora)',
        amount: data.insuranceMonthly,
        currency: data.localCurrency,
        month,
        year,
        paid: false,
        sortOrder: sortOrder++,
      });
    }
  }

  if (data.registrationFee > 0) {
    rows.push({
      userId: session.userId,
      vehicleId: v.id,
      category: 'Patente',
      concept: 'Tasa de empadronamiento',
      amount: data.registrationFee,
      currency: data.localCurrency,
      month: data.loanStartMonth,
      year: data.loanStartYear,
      paid: false,
      sortOrder: sortOrder++,
    });
  }
  if (data.patenteProportional > 0) {
    rows.push({
      userId: session.userId,
      vehicleId: v.id,
      category: 'Patente',
      concept: 'Patente proporcional',
      amount: data.patenteProportional,
      currency: data.localCurrency,
      month: data.loanStartMonth,
      year: data.loanStartYear,
      paid: false,
      sortOrder: sortOrder++,
    });
  }

  if (data.wantsSecurityPack && data.securityPackAmount > 0) {
    const perInstallment = data.securityPackAmount / data.securityPackInstallments;
    const { month: startMonth, year: startYear } = addMonths(
      data.loanStartMonth,
      data.loanStartYear,
      1
    );
    for (let i = 0; i < data.securityPackInstallments; i++) {
      const { month, year } = addMonths(startMonth, startYear, i);
      rows.push({
        userId: session.userId,
        vehicleId: v.id,
        category: 'Otro',
        concept: `Pack de seguridad ${i + 1}/${data.securityPackInstallments}`,
        amount: perInstallment,
        currency: 'USD',
        month,
        year,
        paid: false,
        sortOrder: sortOrder++,
      });
    }
  }

  if (rows.length > 0) await db.insert(vehicleExpense).values(rows);

  revalidate();
  return ok({ id: v.id });
}

/**
 * Alta de un préstamo de auto indexado a la Unidad Indexada (UI, Uruguay):
 * genera las N cuotas con el monto fijo en UI (`amountUi`) y el estimado en
 * pesos de hoy (`amount`), que luego se recalcula solo con la UI vigente
 * (cron diario). Si se pasa `accountMaintenanceFee`, agrega también una fila
 * mensual de mantenimiento de cuenta, en la misma ventana de meses.
 */
export async function createUiIndexedLoan(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = createUiLoanSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const data = parsed.data;

  const uiNow = await getLatestUiValue();
  const firstPaymentPesos =
    Math.round(data.monthlyPaymentUi * uiNow * 100) / 100 + data.fixedSurchargeUyu;

  const [v] = await db
    .insert(vehicle)
    .values({
      userId: session.userId,
      name: data.name,
      version: data.version ?? null,
      year: data.year ?? null,
      totalPrice: data.vehiclePriceUsd,
      downPaymentTarget: data.downPaymentUsd,
      downPaymentSaved: data.downPaymentUsd,
      loanAmount: data.loanAmount,
      loanMonths: data.totalInstallments,
      loanStartMonth: data.firstInstallmentMonth,
      loanStartYear: data.firstInstallmentYear,
      monthlyPayment: firstPaymentPesos,
      currency: 'USD',
      monthlyPaymentCurrency: 'UYU',
      dollarRate: data.dollarRate,
      status: 'financiando',
      loanUnit: 'ui',
      monthlyPaymentUi: data.monthlyPaymentUi,
      uiRateAtOrigination: data.uiRateAtOrigination,
    })
    .returning({ id: vehicle.id });

  const isoDate = (year: number, month: number, day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const rows: (typeof vehicleExpense.$inferInsert)[] = [];
  for (let i = 0; i < data.totalInstallments; i++) {
    const { month, year } = addMonths(data.firstInstallmentMonth, data.firstInstallmentYear, i);
    // Día 5, corrido al siguiente día hábil si cae fin de semana.
    const day = resolveSalaryDepositDay(year, month, 'fixed_day', 5);
    rows.push({
      userId: session.userId,
      vehicleId: v.id,
      category: LOAN_INSTALLMENT_CATEGORY,
      concept: `Cuota ${i + 1}/${data.totalInstallments} (UI ${data.monthlyPaymentUi.toFixed(2)} + $${data.fixedSurchargeUyu})`,
      amount: firstPaymentPesos,
      amountUi: data.monthlyPaymentUi,
      fixedSurchargeUyu: data.fixedSurchargeUyu,
      currency: 'UYU',
      month,
      year,
      dueDate: isoDate(year, month, day),
      paid: false,
      sortOrder: i,
    });
  }
  if (data.insuranceEstimateUyu > 0) {
    for (let i = 0; i < data.totalInstallments; i++) {
      const { month, year } = addMonths(data.firstInstallmentMonth, data.firstInstallmentYear, i);
      rows.push({
        userId: session.userId,
        vehicleId: v.id,
        category: 'Seguro',
        concept: 'Seguro de vida + tasas (misma cuenta BBVA, débito fin de mes) — estimado',
        amount: data.insuranceEstimateUyu,
        currency: 'UYU',
        month,
        year,
        dueDate: isoDate(year, month, daysInMonth(year, month)),
        paid: false,
        note: 'Monto estimado: no hay fórmula confirmada. Ajustar con el resumen real cada mes.',
        sortOrder: data.totalInstallments + i,
      });
    }
  }
  await db.insert(vehicleExpense).values(rows);

  revalidate();
  return ok({ id: v.id });
}

/** Refresca la UI y recalcula en pesos las cuotas pendientes indexadas (botón manual). */
export async function refreshUiLoanInstallments(vehicleId?: string): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  await recalculateUiInstallments(vehicleId);

  revalidate();
  return ok();
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

/**
 * Cancela el saldo del préstamo: marca todas las cuotas pendientes como
 * pagadas (por ejemplo, al liquidarlo anticipadamente en un solo pago) y
 * pasa el vehículo a "pagado".
 */
export async function payOffLoan(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = payOffLoanSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id } = parsed.data;

  const [v] = await db
    .select({ id: vehicle.id })
    .from(vehicle)
    .where(and(eq(vehicle.id, id), eq(vehicle.userId, session.userId)));
  if (!v) return UNAUTHORIZED;

  await db
    .update(vehicleExpense)
    .set({ paid: true })
    .where(
      and(
        eq(vehicleExpense.vehicleId, id),
        eq(vehicleExpense.userId, session.userId),
        eq(vehicleExpense.category, LOAN_INSTALLMENT_CATEGORY)
      )
    );
  await db
    .update(vehicle)
    .set({ status: 'pagado' })
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
      dueDate: data.dueDate ?? null,
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
