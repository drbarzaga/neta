'use server';

import { revalidatePath } from 'next/cache';
import {
  db,
  eq,
  and,
  inArray,
  expense,
  period,
  category,
  expenseTemplate,
  goal,
  goalContribution,
  purchase,
  savingsAccount,
  savingsMovement,
} from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { refreshRate } from '@/lib/exchange-rate';
import { addMonths } from '@/lib/dates';
import { getOrCreateUserSettings } from '../../configuracion/queries';
import {
  addExpenseSchema,
  updateExpenseSchema,
  periodHeaderSchema,
  setDollarRateSchema,
  reorderExpensesSchema,
  setExpenseGoalSchema,
  moveExpenseSchema,
  moveExpenseToPeriodSchema,
  createInstallmentSchema,
  convertToInstallmentsSchema,
  setExpenseSavingsSchema,
} from './schema';

function revalidate(periodId: string) {
  revalidatePath(`/meses/${periodId}`);
  revalidatePath('/meses');
  revalidatePath('/');
  revalidatePath('/analitica');
  revalidatePath('/metas');
}

async function ownsPeriod(userId: string, periodId: string) {
  const [p] = await db
    .select({ id: period.id })
    .from(period)
    .where(and(eq(period.id, periodId), eq(period.userId, userId)));
  return Boolean(p);
}

/** Convierte un monto entre moneda local y USD (las únicas posibles aquí). */
function convertAmount(
  amount: number,
  from: string,
  to: string,
  rate: number
): number {
  if (from === to) return amount;
  const value = to === 'USD' ? (rate > 0 ? amount / rate : 0) : amount * rate;
  return Math.round(value * 100) / 100;
}

/** Suma `delta` al ahorrado de una meta (sin bajar de 0) y revalida su detalle. */
async function adjustGoalSaved(userId: string, goalId: string, delta: number) {
  if (delta === 0) return;
  const [g] = await db
    .select({ saved: goal.savedAmount })
    .from(goal)
    .where(and(eq(goal.id, goalId), eq(goal.userId, userId)));
  if (!g) return;
  await db
    .update(goal)
    .set({ savedAmount: Math.max(0, g.saved + delta) })
    .where(and(eq(goal.id, goalId), eq(goal.userId, userId)));
  revalidatePath(`/metas/${goalId}`);
}

/**
 * Reconcilia el abono automático de un gasto vinculado a una meta. La regla:
 * existe un abono (con expenseId) si y solo si el gasto está vinculado y pagado;
 * su monto es el del gasto convertido a la moneda de la meta (cotización del mes).
 */
async function syncExpenseGoalContribution(userId: string, expenseId: string) {
  const [e] = await db
    .select({
      amount: expense.amount,
      currency: expense.currency,
      status: expense.status,
      goalId: expense.goalId,
      periodId: expense.periodId,
      concept: expense.concept,
    })
    .from(expense)
    .where(and(eq(expense.id, expenseId), eq(expense.userId, userId)));
  if (!e) return;

  const [existing] = await db
    .select()
    .from(goalContribution)
    .where(
      and(
        eq(goalContribution.userId, userId),
        eq(goalContribution.expenseId, expenseId)
      )
    );

  const targetGoalId = e.goalId;
  const desired = targetGoalId !== null && e.status === 'pagado';

  if (!desired || !targetGoalId) {
    if (existing) {
      await adjustGoalSaved(userId, existing.goalId, -existing.amount);
      await db
        .delete(goalContribution)
        .where(eq(goalContribution.id, existing.id));
    }
    return;
  }

  const [g] = await db
    .select({ currency: goal.currency })
    .from(goal)
    .where(and(eq(goal.id, targetGoalId), eq(goal.userId, userId)));
  if (!g) {
    if (existing) {
      await adjustGoalSaved(userId, existing.goalId, -existing.amount);
      await db
        .delete(goalContribution)
        .where(eq(goalContribution.id, existing.id));
    }
    return;
  }

  const [p] = await db
    .select({ rate: period.dollarRate })
    .from(period)
    .where(eq(period.id, e.periodId));
  const amount = convertAmount(e.amount, e.currency, g.currency, p?.rate ?? 0);
  const note = `Gasto: ${e.concept}`;

  if (!existing) {
    await db.insert(goalContribution).values({
      userId,
      goalId: targetGoalId,
      expenseId,
      amount,
      note,
    });
    await adjustGoalSaved(userId, targetGoalId, amount);
    return;
  }

  if (existing.goalId === targetGoalId) {
    await adjustGoalSaved(userId, targetGoalId, amount - existing.amount);
    await db
      .update(goalContribution)
      .set({ amount, note })
      .where(eq(goalContribution.id, existing.id));
  } else {
    await adjustGoalSaved(userId, existing.goalId, -existing.amount);
    await adjustGoalSaved(userId, targetGoalId, amount);
    await db
      .update(goalContribution)
      .set({ goalId: targetGoalId, amount, note })
      .where(eq(goalContribution.id, existing.id));
  }
}

/** Suma `delta` al saldo de un apartado de ahorro (sin bajar de 0). */
async function adjustSavingsBalance(
  userId: string,
  accountId: string,
  delta: number
) {
  if (delta === 0) return;
  const [a] = await db
    .select({ balance: savingsAccount.balance })
    .from(savingsAccount)
    .where(and(eq(savingsAccount.id, accountId), eq(savingsAccount.userId, userId)));
  if (!a) return;
  await db
    .update(savingsAccount)
    .set({ balance: Math.max(0, a.balance + delta) })
    .where(and(eq(savingsAccount.id, accountId), eq(savingsAccount.userId, userId)));
}

/**
 * Reconcilia el aporte automático de un gasto vinculado a un apartado de ahorro.
 * Regla espejo a la de metas: existe un movimiento (con expenseId) si y solo si
 * el gasto está vinculado a un apartado y pagado; su monto es el del gasto
 * convertido a la moneda del apartado (cotización del mes).
 */
async function syncExpenseSavingsMovement(userId: string, expenseId: string) {
  const [e] = await db
    .select({
      amount: expense.amount,
      currency: expense.currency,
      status: expense.status,
      savingsAccountId: expense.savingsAccountId,
      periodId: expense.periodId,
      concept: expense.concept,
    })
    .from(expense)
    .where(and(eq(expense.id, expenseId), eq(expense.userId, userId)));
  if (!e) return;

  const [existing] = await db
    .select()
    .from(savingsMovement)
    .where(
      and(
        eq(savingsMovement.userId, userId),
        eq(savingsMovement.expenseId, expenseId)
      )
    );

  const targetAccountId = e.savingsAccountId;
  const desired = targetAccountId !== null && e.status === 'pagado';

  // No corresponde (desvinculado / no pagado): revierte y borra el movimiento.
  const removeExisting = async () => {
    if (existing) {
      await adjustSavingsBalance(userId, existing.accountId, -existing.amount);
      await db.delete(savingsMovement).where(eq(savingsMovement.id, existing.id));
    }
  };

  if (!desired || !targetAccountId) {
    await removeExisting();
    return;
  }

  const [acc] = await db
    .select({ currency: savingsAccount.currency })
    .from(savingsAccount)
    .where(and(eq(savingsAccount.id, targetAccountId), eq(savingsAccount.userId, userId)));
  if (!acc) {
    await removeExisting();
    return;
  }

  const [p] = await db
    .select({ rate: period.dollarRate })
    .from(period)
    .where(eq(period.id, e.periodId));
  const amount = convertAmount(e.amount, e.currency, acc.currency, p?.rate ?? 0);
  const note = `Gasto: ${e.concept}`;
  const today = new Date().toISOString().slice(0, 10);

  if (!existing) {
    await db.insert(savingsMovement).values({
      userId,
      accountId: targetAccountId,
      expenseId,
      amount,
      note,
      date: today,
    });
    await adjustSavingsBalance(userId, targetAccountId, amount);
    return;
  }

  if (existing.accountId === targetAccountId) {
    await adjustSavingsBalance(userId, targetAccountId, amount - existing.amount);
    await db
      .update(savingsMovement)
      .set({ amount, note })
      .where(eq(savingsMovement.id, existing.id));
  } else {
    await adjustSavingsBalance(userId, existing.accountId, -existing.amount);
    await adjustSavingsBalance(userId, targetAccountId, amount);
    await db
      .update(savingsMovement)
      .set({ accountId: targetAccountId, amount, note })
      .where(eq(savingsMovement.id, existing.id));
  }
}

export async function addExpense(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = addExpenseSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const data = parsed.data;

  if (!(await ownsPeriod(session.userId, data.periodId))) return UNAUTHORIZED;

  const existing = await db
    .select({ sortOrder: expense.sortOrder })
    .from(expense)
    .where(
      and(
        eq(expense.periodId, data.periodId),
        eq(expense.categoryId, data.categoryId)
      )
    );
  const nextOrder = existing.reduce((m, e) => Math.max(m, e.sortOrder), -1) + 1;

  const [row] = await db
    .insert(expense)
    .values({
      userId: session.userId,
      periodId: data.periodId,
      categoryId: data.categoryId,
      concept: data.concept,
      amount: data.amount,
      currency: data.currency,
      sortOrder: nextOrder,
    })
    .returning({ id: expense.id });

  revalidate(data.periodId);
  return ok({ id: row.id });
}

/** Reordena los gastos de una categoría según la lista de ids recibida. */
export async function reorderExpenses(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = reorderExpensesSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { periodId, categoryId, orderedIds } = parsed.data;

  if (!(await ownsPeriod(session.userId, periodId))) return UNAUTHORIZED;

  // Solo tocamos los gastos que pertenecen a este usuario, periodo y categoría.
  const owned = await db
    .select({ id: expense.id })
    .from(expense)
    .where(
      and(
        eq(expense.userId, session.userId),
        eq(expense.periodId, periodId),
        eq(expense.categoryId, categoryId)
      )
    );
  const valid = new Set(owned.map((e) => e.id));

  let order = 0;
  for (const id of orderedIds) {
    if (!valid.has(id)) continue;
    await db
      .update(expense)
      .set({ sortOrder: order++ })
      .where(and(eq(expense.id, id), eq(expense.userId, session.userId)));
  }

  revalidate(periodId);
  return ok();
}

/**
 * Mueve un gasto a otra categoría (o lo reordena en la misma) y fija el orden
 * de la categoría destino. `orderedIds` es el nuevo orden completo del destino,
 * incluyendo el gasto movido.
 */
export async function moveExpense(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = moveExpenseSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, periodId, toCategoryId, orderedIds } = parsed.data;

  if (!(await ownsPeriod(session.userId, periodId))) return UNAUTHORIZED;

  // La categoría destino debe ser del usuario.
  const [cat] = await db
    .select({ id: category.id })
    .from(category)
    .where(and(eq(category.id, toCategoryId), eq(category.userId, session.userId)));
  if (!cat) return fail('Categoría no encontrada');

  // Mueve el gasto a la categoría destino.
  const moved = await db
    .update(expense)
    .set({ categoryId: toCategoryId })
    .where(
      and(
        eq(expense.id, id),
        eq(expense.userId, session.userId),
        eq(expense.periodId, periodId)
      )
    )
    .returning({ id: expense.id });
  if (moved.length === 0) return UNAUTHORIZED;

  // Reordena la categoría destino según orderedIds (solo ids ya en esa categoría).
  const owned = await db
    .select({ id: expense.id })
    .from(expense)
    .where(
      and(
        eq(expense.userId, session.userId),
        eq(expense.periodId, periodId),
        eq(expense.categoryId, toCategoryId)
      )
    );
  const valid = new Set(owned.map((e) => e.id));

  let order = 0;
  for (const eid of orderedIds) {
    if (!valid.has(eid)) continue;
    await db
      .update(expense)
      .set({ sortOrder: order++ })
      .where(and(eq(expense.id, eid), eq(expense.userId, session.userId)));
  }

  revalidate(periodId);
  return ok();
}

/**
 * Mueve un gasto a otro mes conservando su categoría (posponer/adelantar). Lo
 * coloca al final de esa categoría en el mes destino y reconcilia el aporte a
 * la meta (la cotización puede diferir entre meses).
 */
export async function moveExpenseToPeriod(
  input: unknown
): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = moveExpenseToPeriodSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, toPeriodId, resetStatus } = parsed.data;

  // Gasto y su categoría/mes actual (con verificación de propiedad).
  const [current] = await db
    .select({ periodId: expense.periodId, categoryId: expense.categoryId })
    .from(expense)
    .where(and(eq(expense.id, id), eq(expense.userId, session.userId)));
  if (!current) return UNAUTHORIZED;
  if (current.periodId === toPeriodId) return fail('El gasto ya está en ese mes');

  // El mes destino debe ser del usuario.
  if (!(await ownsPeriod(session.userId, toPeriodId))) {
    return fail('Mes destino no encontrado');
  }

  // Se coloca al final de la misma categoría en el mes destino.
  const existing = await db
    .select({ sortOrder: expense.sortOrder })
    .from(expense)
    .where(
      and(
        eq(expense.periodId, toPeriodId),
        eq(expense.categoryId, current.categoryId)
      )
    );
  const nextOrder = existing.reduce((m, e) => Math.max(m, e.sortOrder), -1) + 1;

  await db
    .update(expense)
    .set({
      periodId: toPeriodId,
      sortOrder: nextOrder,
      ...(resetStatus && { status: 'pendiente' }),
    })
    .where(and(eq(expense.id, id), eq(expense.userId, session.userId)));

  // La cotización del mes destino puede diferir: reconcilia el aporte a la meta.
  await syncExpenseGoalContribution(session.userId, id);
  await syncExpenseSavingsMovement(session.userId, id);

  revalidate(current.periodId);
  revalidate(toPeriodId);
  return ok();
}

/**
 * Crea una compra en cuotas: registra el plan y genera "cuota X/N" en cada mes
 * que ya exista (desde el mes de inicio). Los meses que aún no existen reciben
 * su cuota automáticamente al crearse (ver materializeInstallments).
 */
export async function createInstallmentPurchase(
  input: unknown
): Promise<ActionResult<{ created: number; total: number }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = createInstallmentSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const data = parsed.data;

  // La categoría debe ser del usuario.
  const [cat] = await db
    .select({ id: category.id })
    .from(category)
    .where(
      and(eq(category.id, data.categoryId), eq(category.userId, session.userId))
    );
  if (!cat) return fail('Categoría no encontrada');

  const [plan] = await db
    .insert(purchase)
    .values({
      userId: session.userId,
      categoryId: data.categoryId,
      concept: data.concept,
      currency: data.currency,
      installmentAmount: data.installmentAmount,
      installmentsCount: data.installmentsCount,
      startMonth: data.startMonth,
      startYear: data.startYear,
    })
    .returning({ id: purchase.id });

  // Meses del usuario para ubicar cada cuota (los que existan).
  const periods = await db
    .select({ id: period.id, year: period.year, month: period.month })
    .from(period)
    .where(eq(period.userId, session.userId));
  const byKey = new Map(periods.map((p) => [`${p.year}-${p.month}`, p.id]));

  let created = 0;
  const touched = new Set<string>();
  for (let i = 0; i < data.installmentsCount; i++) {
    const { month, year } = addMonths(data.startMonth, data.startYear, i);
    const periodId = byKey.get(`${year}-${month}`);
    if (!periodId) continue; // el mes se completará al crearse

    const existing = await db
      .select({ sortOrder: expense.sortOrder })
      .from(expense)
      .where(
        and(eq(expense.periodId, periodId), eq(expense.categoryId, data.categoryId))
      );
    const nextOrder = existing.reduce((m, e) => Math.max(m, e.sortOrder), -1) + 1;

    await db.insert(expense).values({
      userId: session.userId,
      periodId,
      categoryId: data.categoryId,
      concept: `${data.concept} (cuota ${i + 1}/${data.installmentsCount})`,
      amount: data.installmentAmount,
      currency: data.currency,
      status: 'pendiente',
      purchaseId: plan.id,
      installmentNumber: i + 1,
      installmentsCount: data.installmentsCount,
      sortOrder: nextOrder,
    });
    created++;
    touched.add(periodId);
  }

  for (const pid of touched) revalidate(pid);
  revalidatePath('/meses');
  revalidatePath('/');
  return ok({ created, total: data.installmentsCount });
}

/** Elimina una compra en cuotas y todas sus cuotas (en todos los meses). */
export async function deletePurchase(purchaseId: string): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  // Períodos afectados (para revalidar) antes de borrar.
  const rows = await db
    .select({ periodId: expense.periodId })
    .from(expense)
    .where(
      and(
        eq(expense.userId, session.userId),
        eq(expense.purchaseId, purchaseId)
      )
    );

  const result = await db
    .delete(purchase)
    .where(and(eq(purchase.id, purchaseId), eq(purchase.userId, session.userId)))
    .returning({ id: purchase.id });
  if (result.length === 0) return UNAUTHORIZED;

  for (const r of new Set(rows.map((r) => r.periodId))) revalidate(r);
  return ok();
}

/**
 * Convierte un gasto ya cargado en una compra en cuotas: el gasto pasa a ser la
 * cuota 1/N (en su mes) y se generan las cuotas 2..N en los meses siguientes.
 * Si `amountIsTotal`, el monto del gasto se divide en N; si no, se toma como el
 * monto de cada cuota. La cuota 1 absorbe el redondeo para que la suma sea exacta.
 */
export async function convertExpenseToInstallments(
  input: unknown
): Promise<ActionResult<{ created: number; total: number }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = convertToInstallmentsSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const { id, installmentsCount: n, amountIsTotal } = parsed.data;

  const [e] = await db
    .select({
      amount: expense.amount,
      currency: expense.currency,
      concept: expense.concept,
      categoryId: expense.categoryId,
      purchaseId: expense.purchaseId,
      year: period.year,
      month: period.month,
    })
    .from(expense)
    .innerJoin(period, eq(expense.periodId, period.id))
    .where(and(eq(expense.id, id), eq(expense.userId, session.userId)));
  if (!e) return UNAUTHORIZED;
  if (e.purchaseId) return fail('Este gasto ya es una compra en cuotas');
  if (e.amount <= 0) return fail('El gasto no tiene un monto para dividir');

  // Monto por cuota; la cuota 1 (el gasto actual) absorbe el resto del redondeo.
  const round2 = (x: number) => Math.round(x * 100) / 100;
  const perCuota = amountIsTotal ? round2(e.amount / n) : e.amount;
  const firstAmount = amountIsTotal
    ? round2(e.amount - perCuota * (n - 1))
    : e.amount;

  const [plan] = await db
    .insert(purchase)
    .values({
      userId: session.userId,
      categoryId: e.categoryId,
      concept: e.concept,
      currency: e.currency,
      installmentAmount: perCuota,
      installmentsCount: n,
      startMonth: e.month,
      startYear: e.year,
    })
    .returning({ id: purchase.id });

  // El gasto existente pasa a ser la cuota 1/N.
  await db
    .update(expense)
    .set({
      concept: `${e.concept} (cuota 1/${n})`,
      amount: firstAmount,
      purchaseId: plan.id,
      installmentNumber: 1,
      installmentsCount: n,
    })
    .where(and(eq(expense.id, id), eq(expense.userId, session.userId)));
  await syncExpenseGoalContribution(session.userId, id);
  await syncExpenseSavingsMovement(session.userId, id);

  // Cuotas 2..N en los meses que existan (las futuras se crean al hacer el mes).
  const periods = await db
    .select({ id: period.id, year: period.year, month: period.month })
    .from(period)
    .where(eq(period.userId, session.userId));
  const byKey = new Map(periods.map((p) => [`${p.year}-${p.month}`, p.id]));

  let created = 1; // la cuota 1 ya existe
  const touched = new Set<string>();
  for (let i = 1; i < n; i++) {
    const { month, year } = addMonths(e.month, e.year, i);
    const periodId = byKey.get(`${year}-${month}`);
    if (!periodId) continue;

    const existing = await db
      .select({ sortOrder: expense.sortOrder })
      .from(expense)
      .where(
        and(eq(expense.periodId, periodId), eq(expense.categoryId, e.categoryId))
      );
    const nextOrder = existing.reduce((m, x) => Math.max(m, x.sortOrder), -1) + 1;

    await db.insert(expense).values({
      userId: session.userId,
      periodId,
      categoryId: e.categoryId,
      concept: `${e.concept} (cuota ${i + 1}/${n})`,
      amount: perCuota,
      currency: e.currency,
      status: 'pendiente',
      purchaseId: plan.id,
      installmentNumber: i + 1,
      installmentsCount: n,
      sortOrder: nextOrder,
    });
    created++;
    touched.add(periodId);
  }

  for (const pid of touched) revalidate(pid);
  revalidatePath('/meses');
  revalidatePath('/');
  return ok({ created, total: n });
}

export async function updateExpense(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = updateExpenseSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, ...fields } = parsed.data;

  const [current] = await db
    .select({ periodId: expense.periodId })
    .from(expense)
    .where(and(eq(expense.id, id), eq(expense.userId, session.userId)));
  if (!current) return UNAUTHORIZED;

  await db
    .update(expense)
    .set(fields)
    .where(and(eq(expense.id, id), eq(expense.userId, session.userId)));

  // El monto/moneda/estado pudo cambiar: reconcilia el aporte a la meta vinculada.
  await syncExpenseGoalContribution(session.userId, id);
  await syncExpenseSavingsMovement(session.userId, id);

  revalidate(current.periodId);
  return ok();
}

/** Vincula (o desvincula con null) un gasto a una meta y reconcilia el aporte. */
export async function setExpenseGoal(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = setExpenseGoalSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, goalId } = parsed.data;

  const [current] = await db
    .select({ periodId: expense.periodId })
    .from(expense)
    .where(and(eq(expense.id, id), eq(expense.userId, session.userId)));
  if (!current) return UNAUTHORIZED;

  if (goalId) {
    const [g] = await db
      .select({ id: goal.id })
      .from(goal)
      .where(and(eq(goal.id, goalId), eq(goal.userId, session.userId)));
    if (!g) return fail('Meta no encontrada');
  }

  // Meta y ahorro son destinos mutuamente excluyentes: al fijar meta, desvincula
  // el apartado (y viceversa en setExpenseSavings).
  await db
    .update(expense)
    .set({ goalId, ...(goalId ? { savingsAccountId: null } : {}) })
    .where(and(eq(expense.id, id), eq(expense.userId, session.userId)));

  await syncExpenseGoalContribution(session.userId, id);
  await syncExpenseSavingsMovement(session.userId, id);

  revalidate(current.periodId);
  return ok();
}

/** Vincula (o desvincula con null) un gasto a un apartado de ahorro. */
export async function setExpenseSavings(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = setExpenseSavingsSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, savingsAccountId } = parsed.data;

  const [current] = await db
    .select({ periodId: expense.periodId })
    .from(expense)
    .where(and(eq(expense.id, id), eq(expense.userId, session.userId)));
  if (!current) return UNAUTHORIZED;

  if (savingsAccountId) {
    const [a] = await db
      .select({ id: savingsAccount.id })
      .from(savingsAccount)
      .where(
        and(
          eq(savingsAccount.id, savingsAccountId),
          eq(savingsAccount.userId, session.userId)
        )
      );
    if (!a) return fail('Apartado de ahorro no encontrado');
  }

  await db
    .update(expense)
    .set({ savingsAccountId, ...(savingsAccountId ? { goalId: null } : {}) })
    .where(and(eq(expense.id, id), eq(expense.userId, session.userId)));

  await syncExpenseSavingsMovement(session.userId, id);
  await syncExpenseGoalContribution(session.userId, id);

  revalidate(current.periodId);
  return ok();
}

export async function saveExpenseAsTemplate(
  expenseId: string
): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const [e] = await db
    .select()
    .from(expense)
    .where(and(eq(expense.id, expenseId), eq(expense.userId, session.userId)));
  if (!e) return UNAUTHORIZED;

  const existing = await db
    .select({ sortOrder: expenseTemplate.sortOrder })
    .from(expenseTemplate)
    .where(eq(expenseTemplate.userId, session.userId));
  const nextOrder = existing.reduce((m, t) => Math.max(m, t.sortOrder), -1) + 1;

  await db.insert(expenseTemplate).values({
    userId: session.userId,
    categoryId: e.categoryId,
    concept: e.concept,
    amount: e.amount,
    currency: e.currency,
    sortOrder: nextOrder,
  });

  revalidatePath('/plantillas');
  return ok();
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const [current] = await db
    .select({ periodId: expense.periodId })
    .from(expense)
    .where(and(eq(expense.id, id), eq(expense.userId, session.userId)));
  if (!current) return UNAUTHORIZED;

  // Si tenía un aporte automático a una meta, revierte el monto antes de borrar.
  const [contrib] = await db
    .select({ id: goalContribution.id, goalId: goalContribution.goalId, amount: goalContribution.amount })
    .from(goalContribution)
    .where(
      and(
        eq(goalContribution.userId, session.userId),
        eq(goalContribution.expenseId, id)
      )
    );
  if (contrib) {
    await adjustGoalSaved(session.userId, contrib.goalId, -contrib.amount);
  }

  // Ídem para el aporte automático a un apartado de ahorro.
  const [mov] = await db
    .select({ id: savingsMovement.id, accountId: savingsMovement.accountId, amount: savingsMovement.amount })
    .from(savingsMovement)
    .where(
      and(
        eq(savingsMovement.userId, session.userId),
        eq(savingsMovement.expenseId, id)
      )
    );
  if (mov) {
    await adjustSavingsBalance(session.userId, mov.accountId, -mov.amount);
  }

  await db
    .delete(expense)
    .where(and(eq(expense.id, id), eq(expense.userId, session.userId)));

  revalidate(current.periodId);
  return ok();
}

export async function updatePeriodHeader(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = periodHeaderSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, incomeTotal, dollarRate } = parsed.data;

  const result = await db
    .update(period)
    .set({ incomeTotal, dollarRate })
    .where(and(eq(period.id, id), eq(period.userId, session.userId)))
    .returning({ id: period.id });

  if (result.length === 0) return UNAUTHORIZED;

  revalidate(id);
  return ok();
}

/** Trae la cotización actual del dólar (dolarapi UY) y la aplica al mes. */
export async function refreshDollarRate(
  periodId: string
): Promise<ActionResult<{ rate: number }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;
  if (!(await ownsPeriod(session.userId, periodId))) return UNAUTHORIZED;

  const settings = await getOrCreateUserSettings(session.userId);
  const rate = await refreshRate(settings.country, settings.arCasa);
  await db
    .update(period)
    .set({ dollarRate: rate })
    .where(and(eq(period.id, periodId), eq(period.userId, session.userId)));

  revalidate(periodId);
  return ok({ rate });
}

/**
 * Trae la cotización actual del mercado SIN aplicarla al mes, para que el
 * usuario decida si la usa o mantiene su valor manual.
 */
export async function fetchMarketRate(
  periodId: string
): Promise<ActionResult<{ rate: number; source: string }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;
  if (!(await ownsPeriod(session.userId, periodId))) return UNAUTHORIZED;

  const settings = await getOrCreateUserSettings(session.userId);
  const rate = await refreshRate(settings.country, settings.arCasa);
  if (!rate || rate <= 0) return fail('No se pudo obtener la cotización del mercado');
  // Para Argentina la "fuente" es la casa elegida (blue, oficial…); si no, dolarapi.
  const source = settings.country === 'AR' ? `dólar ${settings.arCasa}` : 'dolarapi';
  return ok({ rate, source });
}

/** Ajusta manualmente la cotización del dólar del mes (sin tocar el ingreso). */
export async function setDollarRate(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = setDollarRateSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const { id, dollarRate } = parsed.data;

  const result = await db
    .update(period)
    .set({ dollarRate })
    .where(and(eq(period.id, id), eq(period.userId, session.userId)))
    .returning({ id: period.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidate(id);
  return ok();
}

/** Inserta gastos en el mes a partir de una lista de plantillas. */
export async function addExpensesFromTemplates(
  periodId: string,
  templateIds: string[]
): Promise<ActionResult<{ count: number }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;
  if (!(await ownsPeriod(session.userId, periodId))) return UNAUTHORIZED;
  if (templateIds.length === 0) return fail('No se seleccionaron plantillas');

  const templates = await db
    .select()
    .from(expenseTemplate)
    .where(
      and(
        eq(expenseTemplate.userId, session.userId),
        inArray(expenseTemplate.id, templateIds)
      )
    );
  if (templates.length === 0) return fail('Plantillas no encontradas');

  const existing = await db
    .select({ sortOrder: expense.sortOrder })
    .from(expense)
    .where(eq(expense.periodId, periodId));
  let order = existing.reduce((m, e) => Math.max(m, e.sortOrder), -1) + 1;

  await db.insert(expense).values(
    templates.map((t) => ({
      userId: session.userId,
      periodId,
      categoryId: t.categoryId,
      concept: t.concept,
      amount: t.amount,
      currency: t.currency,
      sortOrder: order++,
    }))
  );

  revalidate(periodId);
  return ok({ count: templates.length });
}
