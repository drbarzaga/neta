'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, goal, goalContribution } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import {
  createGoalSchema,
  updateGoalSchema,
  contributeGoalSchema,
  toggleGoalSchema,
  deleteContributionSchema,
} from './schema';

function revalidate(id?: string) {
  revalidatePath('/metas');
  revalidatePath('/');
  if (id) revalidatePath(`/metas/${id}`);
}

export async function createGoal(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = createGoalSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const data = parsed.data;

  const existing = await db
    .select({ sortOrder: goal.sortOrder })
    .from(goal)
    .where(eq(goal.userId, session.userId));
  const nextOrder = existing.reduce((m, g) => Math.max(m, g.sortOrder), -1) + 1;

  await db.insert(goal).values({
    userId: session.userId,
    title: data.title,
    targetAmount: data.targetAmount,
    savedAmount: data.savedAmount,
    currency: data.currency,
    targetDate: data.targetDate ?? null,
    note: data.note ?? null,
    color: data.color,
    sortOrder: nextOrder,
  });

  revalidate();
  return ok();
}

export async function updateGoal(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = updateGoalSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const { id, ...fields } = parsed.data;

  const result = await db
    .update(goal)
    .set(fields)
    .where(and(eq(goal.id, id), eq(goal.userId, session.userId)))
    .returning({ id: goal.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidate(id);
  return ok();
}

/** Registra un abono: suma al ahorrado (no baja de 0) y lo guarda en el historial. */
export async function contributeGoal(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = contributeGoalSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, amount, note } = parsed.data;
  if (amount === 0) return fail('El abono no puede ser 0');

  const [current] = await db
    .select({ saved: goal.savedAmount })
    .from(goal)
    .where(and(eq(goal.id, id), eq(goal.userId, session.userId)));
  if (!current) return UNAUTHORIZED;

  const next = Math.max(0, current.saved + amount);
  await db
    .update(goal)
    .set({ savedAmount: next })
    .where(and(eq(goal.id, id), eq(goal.userId, session.userId)));
  await db.insert(goalContribution).values({
    userId: session.userId,
    goalId: id,
    amount,
    note: note ?? null,
  });

  revalidate(id);
  return ok();
}

/** Borra un abono del historial y revierte su monto del ahorrado. */
export async function deleteContribution(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = deleteContributionSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');

  const [c] = await db
    .select({
      amount: goalContribution.amount,
      goalId: goalContribution.goalId,
      expenseId: goalContribution.expenseId,
    })
    .from(goalContribution)
    .where(
      and(
        eq(goalContribution.id, parsed.data.id),
        eq(goalContribution.userId, session.userId)
      )
    );
  if (!c) return UNAUTHORIZED;
  if (c.expenseId) {
    return fail('Este abono viene de un gasto vinculado; edítalo desde el mes.');
  }

  const [g] = await db
    .select({ saved: goal.savedAmount })
    .from(goal)
    .where(and(eq(goal.id, c.goalId), eq(goal.userId, session.userId)));

  await db
    .delete(goalContribution)
    .where(eq(goalContribution.id, parsed.data.id));
  if (g) {
    await db
      .update(goal)
      .set({ savedAmount: Math.max(0, g.saved - c.amount) })
      .where(and(eq(goal.id, c.goalId), eq(goal.userId, session.userId)));
  }

  revalidate(c.goalId);
  return ok();
}

export async function toggleGoalCompleted(
  input: unknown
): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = toggleGoalSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, completed } = parsed.data;

  const result = await db
    .update(goal)
    .set({ completed, completedAt: completed ? new Date() : null })
    .where(and(eq(goal.id, id), eq(goal.userId, session.userId)))
    .returning({ id: goal.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidate(id);
  return ok();
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  await db
    .delete(goal)
    .where(and(eq(goal.id, id), eq(goal.userId, session.userId)));

  revalidate();
  return ok();
}
