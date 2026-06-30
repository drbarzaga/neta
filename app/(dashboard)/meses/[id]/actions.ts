'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, inArray, expense, period, expenseTemplate } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { refreshRate } from '@/lib/exchange-rate';
import { getOrCreateUserSettings } from '../../configuracion/queries';
import {
  addExpenseSchema,
  updateExpenseSchema,
  periodHeaderSchema,
  reorderExpensesSchema,
} from './schema';

function revalidate(periodId: string) {
  revalidatePath(`/meses/${periodId}`);
  revalidatePath('/meses');
  revalidatePath('/');
  revalidatePath('/analitica');
}

async function ownsPeriod(userId: string, periodId: string) {
  const [p] = await db
    .select({ id: period.id })
    .from(period)
    .where(and(eq(period.id, periodId), eq(period.userId, userId)));
  return Boolean(p);
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
