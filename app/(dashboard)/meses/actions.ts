'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, ne, desc, isNull, period, expense, purchase } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { getLatestRate } from '@/lib/exchange-rate';
import { getCountry } from '@/lib/countries';
import { ensureDefaultCategories } from '@/lib/categories';
import { periodLabel, nextMonth, monthDiff } from '@/lib/dates';
import { getOrCreateUserSettings } from '../configuracion/queries';
import { createPeriodSchema } from './schema';

async function cloneExpenses(
  userId: string,
  sourcePeriodId: string,
  targetPeriodId: string,
  resetAmounts = false
) {
  const source = await db
    .select()
    .from(expense)
    .where(
      and(
        eq(expense.userId, userId),
        eq(expense.periodId, sourcePeriodId),
        // Las cuotas de una compra las coloca su plan, no la clonación.
        isNull(expense.purchaseId)
      )
    );
  if (source.length === 0) return;

  await db.insert(expense).values(
    source.map((e) => ({
      userId,
      periodId: targetPeriodId,
      categoryId: e.categoryId,
      concept: e.concept,
      amount: resetAmounts ? 0 : e.amount,
      currency: e.currency,
      status: 'pendiente' as const,
      dueDate: null,
      recurring: e.recurring,
      sortOrder: e.sortOrder,
    }))
  );
}

/**
 * Agrega al mes nuevo los gastos marcados como recurrentes tomándolos del mes
 * más reciente del usuario (distinto del nuevo). Cada copia sigue siendo
 * recurrente para propagarse al siguiente mes.
 */
async function addRecurringExpenses(
  userId: string,
  targetPeriodId: string
) {
  const [latest] = await db
    .select({ id: period.id })
    .from(period)
    .where(and(eq(period.userId, userId), ne(period.id, targetPeriodId)))
    .orderBy(desc(period.year), desc(period.month))
    .limit(1);
  if (!latest) return;

  const recurring = await db
    .select()
    .from(expense)
    .where(
      and(
        eq(expense.userId, userId),
        eq(expense.periodId, latest.id),
        eq(expense.recurring, true),
        // Una cuota no es "recurrente": su repetición la maneja el plan de compra.
        isNull(expense.purchaseId)
      )
    );
  if (recurring.length === 0) return;

  await db.insert(expense).values(
    recurring.map((e) => ({
      userId,
      periodId: targetPeriodId,
      categoryId: e.categoryId,
      concept: e.concept,
      amount: e.amount,
      currency: e.currency,
      status: 'pendiente' as const,
      dueDate: null,
      recurring: true,
      sortOrder: e.sortOrder,
    }))
  );
}

/**
 * Crea las cuotas de compras en cuotas que caen en este mes (year/month) y que
 * todavía no se generaron. Se llama al crear un período nuevo.
 */
async function materializeInstallments(
  userId: string,
  targetPeriodId: string,
  year: number,
  month: number
) {
  const plans = await db
    .select()
    .from(purchase)
    .where(eq(purchase.userId, userId));
  if (plans.length === 0) return;

  for (const plan of plans) {
    // Offset de este mes respecto al inicio del plan; la cuota es offset+1.
    const offset = monthDiff(plan.startMonth, plan.startYear, month, year);
    if (offset < 0 || offset >= plan.installmentsCount) continue;
    const installmentNumber = offset + 1;

    // Evita duplicar si esa cuota ya existe en este período.
    const [existing] = await db
      .select({ id: expense.id })
      .from(expense)
      .where(
        and(
          eq(expense.userId, userId),
          eq(expense.periodId, targetPeriodId),
          eq(expense.purchaseId, plan.id),
          eq(expense.installmentNumber, installmentNumber)
        )
      );
    if (existing) continue;

    await db.insert(expense).values({
      userId,
      periodId: targetPeriodId,
      categoryId: plan.categoryId,
      concept: `${plan.concept} (cuota ${installmentNumber}/${plan.installmentsCount})`,
      amount: plan.installmentAmount,
      currency: plan.currency,
      status: 'pendiente',
      purchaseId: plan.id,
      installmentNumber,
      installmentsCount: plan.installmentsCount,
    });
  }
}

export async function createPeriod(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = createPeriodSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { year, month, incomeTotal, cloneFromId, resetAmounts } = parsed.data;

  const [dup] = await db
    .select({ id: period.id })
    .from(period)
    .where(
      and(
        eq(period.userId, session.userId),
        eq(period.year, year),
        eq(period.month, month)
      )
    );
  if (dup) return fail('Ya existe un mes para ese período');

  await ensureDefaultCategories(session.userId);
  const settings = await getOrCreateUserSettings(session.userId);
  const localCurrency = getCountry(settings.country).currency;
  const rate = await getLatestRate(settings.country, settings.arCasa);

  const [row] = await db
    .insert(period)
    .values({
      userId: session.userId,
      label: periodLabel(month, year),
      year,
      month,
      incomeTotal,
      localCurrency,
      dollarRate: rate,
    })
    .returning({ id: period.id });

  if (cloneFromId) {
    const [src] = await db
      .select({ id: period.id })
      .from(period)
      .where(and(eq(period.id, cloneFromId), eq(period.userId, session.userId)));
    if (src) await cloneExpenses(session.userId, cloneFromId, row.id, resetAmounts);
  } else {
    // Mes "en blanco": igual arrastra los gastos recurrentes del último mes.
    await addRecurringExpenses(session.userId, row.id);
  }

  // Cuotas de compras en cuotas que caen en este mes.
  await materializeInstallments(session.userId, row.id, year, month);

  revalidatePath('/meses');
  revalidatePath('/');
  return ok({ id: row.id });
}

export async function duplicatePeriod(
  sourceId: string,
  resetAmounts = false
): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const [src] = await db
    .select()
    .from(period)
    .where(and(eq(period.id, sourceId), eq(period.userId, session.userId)));
  if (!src) return UNAUTHORIZED;

  const { month, year } = nextMonth(src.month, src.year);
  return createPeriod({
    year,
    month,
    // Con montos en cero también se reinicia el ingreso.
    incomeTotal: resetAmounts ? 0 : src.incomeTotal,
    cloneFromId: sourceId,
    resetAmounts,
  });
}

export async function setPeriodStatus(
  id: string,
  status: 'open' | 'closed'
): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const result = await db
    .update(period)
    .set({ status })
    .where(and(eq(period.id, id), eq(period.userId, session.userId)))
    .returning({ id: period.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidatePath('/meses');
  revalidatePath(`/meses/${id}`);
  return ok();
}

export async function deletePeriod(id: string): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const result = await db
    .delete(period)
    .where(and(eq(period.id, id), eq(period.userId, session.userId)))
    .returning({ id: period.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidatePath('/meses');
  revalidatePath('/');
  return ok();
}
