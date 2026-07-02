'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, ne, desc, period, expense } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { getLatestRate } from '@/lib/exchange-rate';
import { getCountry } from '@/lib/countries';
import { ensureDefaultCategories } from '@/lib/categories';
import { periodLabel, nextMonth } from '@/lib/dates';
import { getOrCreateUserSettings } from '../configuracion/queries';
import { createPeriodSchema } from './schema';

async function cloneExpenses(
  userId: string,
  sourcePeriodId: string,
  targetPeriodId: string
) {
  const source = await db
    .select()
    .from(expense)
    .where(and(eq(expense.userId, userId), eq(expense.periodId, sourcePeriodId)));
  if (source.length === 0) return;

  await db.insert(expense).values(
    source.map((e) => ({
      userId,
      periodId: targetPeriodId,
      categoryId: e.categoryId,
      concept: e.concept,
      amount: e.amount,
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
        eq(expense.recurring, true)
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

export async function createPeriod(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = createPeriodSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { year, month, incomeTotal, cloneFromId } = parsed.data;

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
    if (src) await cloneExpenses(session.userId, cloneFromId, row.id);
  } else {
    // Mes "en blanco": igual arrastra los gastos recurrentes del último mes.
    await addRecurringExpenses(session.userId, row.id);
  }

  revalidatePath('/meses');
  revalidatePath('/');
  return ok({ id: row.id });
}

export async function duplicatePeriod(
  sourceId: string
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
    incomeTotal: src.incomeTotal,
    cloneFromId: sourceId,
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
