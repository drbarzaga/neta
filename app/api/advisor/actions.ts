'use server';

import { z } from 'zod';
import { db, eq, and, desc, period, category, expense, goal } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { addExpense, updateExpense } from '@/app/(dashboard)/meses/[id]/actions';
import { createGoal, contributeGoal } from '@/app/(dashboard)/metas/actions';

export interface AdvisorActionResult {
  ok: boolean;
  error?: string;
}

const advisorActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add_expense'),
    category: z.string().min(1),
    concept: z.string().min(1),
    amount: z.number().min(0),
    currency: z.string().optional(),
  }),
  z.object({
    type: z.literal('mark_paid'),
    concept: z.string().min(1),
  }),
  z.object({
    type: z.literal('create_goal'),
    title: z.string().min(1),
    target: z.number().min(0),
    currency: z.string().optional(),
    targetDate: z.string().nullable().optional(),
  }),
  z.object({
    type: z.literal('contribute_goal'),
    goal: z.string().min(1),
    amount: z.number(),
  }),
]);

const norm = (s: string) => s.trim().toLowerCase();

/** Ejecuta una acción propuesta por el asesor (tras confirmación del usuario). */
export async function executeAdvisorAction(
  input: unknown
): Promise<AdvisorActionResult> {
  const session = await verifySession();
  if (!session) return { ok: false, error: 'No autorizado' };

  const parsed = advisorActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Acción inválida' };
  const a = parsed.data;

  // Mes más reciente (sobre el que opera el asesor).
  const [latest] = await db
    .select({ id: period.id, localCurrency: period.localCurrency })
    .from(period)
    .where(eq(period.userId, session.userId))
    .orderBy(desc(period.year), desc(period.month))
    .limit(1);

  if (a.type === 'add_expense') {
    if (!latest) return { ok: false, error: 'No tienes un mes creado' };
    const cats = await db
      .select({ id: category.id, name: category.name })
      .from(category)
      .where(eq(category.userId, session.userId));
    const cat = cats.find((c) => norm(c.name) === norm(a.category));
    if (!cat) return { ok: false, error: `No encontré la categoría "${a.category}"` };
    const res = await addExpense({
      periodId: latest.id,
      categoryId: cat.id,
      concept: a.concept,
      amount: a.amount,
      currency: a.currency ?? latest.localCurrency,
    });
    return { ok: res.ok, error: res.error };
  }

  if (a.type === 'mark_paid') {
    if (!latest) return { ok: false, error: 'No tienes un mes creado' };
    const items = await db
      .select({ id: expense.id, concept: expense.concept, status: expense.status })
      .from(expense)
      .where(
        and(eq(expense.userId, session.userId), eq(expense.periodId, latest.id))
      );
    const match =
      items.find((e) => norm(e.concept) === norm(a.concept) && e.status !== 'pagado') ??
      items.find((e) => norm(e.concept) === norm(a.concept));
    if (!match) return { ok: false, error: `No encontré el gasto "${a.concept}"` };
    const res = await updateExpense({ id: match.id, status: 'pagado' });
    return { ok: res.ok, error: res.error };
  }

  if (a.type === 'create_goal') {
    const res = await createGoal({
      title: a.title,
      targetAmount: a.target,
      currency: a.currency ?? latest?.localCurrency ?? 'UYU',
      targetDate: a.targetDate ?? null,
    });
    return { ok: res.ok, error: res.error };
  }

  // contribute_goal
  const goals = await db
    .select({ id: goal.id, title: goal.title })
    .from(goal)
    .where(eq(goal.userId, session.userId));
  const g = goals.find((x) => norm(x.title) === norm(a.goal));
  if (!g) return { ok: false, error: `No encontré la meta "${a.goal}"` };
  const res = await contributeGoal({ id: g.id, amount: a.amount });
  return { ok: res.ok, error: res.error };
}
