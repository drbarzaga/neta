'use server';

import { z } from 'zod';
import {
  db,
  eq,
  and,
  desc,
  asc,
  period,
  category,
  expense,
  goal,
  advisorMessage,
} from '@/db';
import { verifySession } from '@/lib/auth-server';
import {
  buildAdvisorInsights,
  type AdvisorInsight,
} from '@/lib/advisor-context';
import {
  addExpense,
  updateExpense,
  deleteExpense,
  updatePeriodHeader,
} from '@/app/(dashboard)/meses/[id]/actions';
import { createPeriod } from '@/app/(dashboard)/meses/actions';
import { addCategory } from '@/app/(dashboard)/categorias/actions';
import {
  createGoal,
  contributeGoal,
  updateGoal,
  toggleGoalCompleted,
} from '@/app/(dashboard)/metas/actions';

export interface AdvisorActionResult {
  ok: boolean;
  error?: string;
}

export interface AdvisorHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_HISTORY = 40;

/** Devuelve el historial guardado de la conversación con el asesor. */
export async function getAdvisorHistory(): Promise<AdvisorHistoryMessage[]> {
  const session = await verifySession();
  if (!session) return [];
  const rows = await db
    .select({ role: advisorMessage.role, content: advisorMessage.content })
    .from(advisorMessage)
    .where(eq(advisorMessage.userId, session.userId))
    .orderBy(asc(advisorMessage.createdAt))
    .limit(MAX_HISTORY);
  return rows.map((r) => ({
    role: r.role === 'assistant' ? 'assistant' : 'user',
    content: r.content,
  }));
}

/** Chequeo de salud financiera para mostrar al abrir el asesor. */
export async function getAdvisorInsights(): Promise<AdvisorInsight[]> {
  const session = await verifySession();
  if (!session) return [];
  return buildAdvisorInsights(session.userId);
}

/** Borra toda la conversación guardada (botón "Nueva conversación"). */
export async function clearAdvisorHistory(): Promise<AdvisorActionResult> {
  const session = await verifySession();
  if (!session) return { ok: false, error: 'No autorizado' };
  await db
    .delete(advisorMessage)
    .where(eq(advisorMessage.userId, session.userId));
  return { ok: true };
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
  z.object({
    type: z.literal('create_month'),
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
    copyFromMonth: z.number().int().min(1).max(12).optional(),
    copyFromYear: z.number().int().min(2000).max(2100).optional(),
  }),
  z.object({
    type: z.literal('set_income'),
    amount: z.number().min(0),
    dollarRate: z.number().min(0).optional(),
  }),
  z.object({
    type: z.literal('edit_expense'),
    concept: z.string().min(1),
    amount: z.number().min(0).optional(),
    currency: z.string().optional(),
    dueDate: z.string().nullable().optional(),
    status: z.enum(['pendiente', 'pagado', 'vencido']).optional(),
  }),
  z.object({
    type: z.literal('delete_expense'),
    concept: z.string().min(1),
  }),
  z.object({
    type: z.literal('create_category'),
    name: z.string().min(1),
    icon: z.string().optional(),
    color: z.string().optional(),
  }),
  z.object({
    type: z.literal('complete_goal'),
    goal: z.string().min(1),
  }),
  z.object({
    type: z.literal('update_goal'),
    goal: z.string().min(1),
    target: z.number().min(0).optional(),
    targetDate: z.string().nullable().optional(),
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
    .select({
      id: period.id,
      localCurrency: period.localCurrency,
      dollarRate: period.dollarRate,
    })
    .from(period)
    .where(eq(period.userId, session.userId))
    .orderBy(desc(period.year), desc(period.month))
    .limit(1);

  // Resuelve un gasto del mes más reciente por concepto (prioriza no pagado).
  async function findExpense(concept: string) {
    if (!latest) return null;
    const items = await db
      .select({ id: expense.id, concept: expense.concept, status: expense.status })
      .from(expense)
      .where(
        and(eq(expense.userId, session!.userId), eq(expense.periodId, latest.id))
      );
    return (
      items.find((e) => norm(e.concept) === norm(concept) && e.status !== 'pagado') ??
      items.find((e) => norm(e.concept) === norm(concept)) ??
      null
    );
  }

  // Resuelve una meta por título.
  async function findGoal(title: string) {
    const goals = await db
      .select({ id: goal.id, title: goal.title })
      .from(goal)
      .where(eq(goal.userId, session!.userId));
    return goals.find((x) => norm(x.title) === norm(title)) ?? null;
  }

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
    const match = await findExpense(a.concept);
    if (!match) return { ok: false, error: `No encontré el gasto "${a.concept}"` };
    const res = await updateExpense({ id: match.id, status: 'pagado' });
    return { ok: res.ok, error: res.error };
  }

  if (a.type === 'edit_expense') {
    if (!latest) return { ok: false, error: 'No tienes un mes creado' };
    const match = await findExpense(a.concept);
    if (!match) return { ok: false, error: `No encontré el gasto "${a.concept}"` };
    const res = await updateExpense({
      id: match.id,
      ...(a.amount !== undefined && { amount: a.amount }),
      ...(a.currency && { currency: a.currency }),
      ...(a.dueDate !== undefined && { dueDate: a.dueDate }),
      ...(a.status && { status: a.status }),
    });
    return { ok: res.ok, error: res.error };
  }

  if (a.type === 'delete_expense') {
    if (!latest) return { ok: false, error: 'No tienes un mes creado' };
    const match = await findExpense(a.concept);
    if (!match) return { ok: false, error: `No encontré el gasto "${a.concept}"` };
    const res = await deleteExpense(match.id);
    return { ok: res.ok, error: res.error };
  }

  if (a.type === 'set_income') {
    if (!latest) return { ok: false, error: 'No tienes un mes creado' };
    const res = await updatePeriodHeader({
      id: latest.id,
      incomeTotal: a.amount,
      dollarRate: a.dollarRate ?? latest.dollarRate ?? 0,
    });
    return { ok: res.ok, error: res.error };
  }

  if (a.type === 'create_category') {
    const res = await addCategory({
      name: a.name,
      icon: a.icon ?? 'tag',
      color: a.color ?? '#64748b',
    });
    return { ok: res.ok, error: res.error };
  }

  if (a.type === 'complete_goal') {
    const g = await findGoal(a.goal);
    if (!g) return { ok: false, error: `No encontré la meta "${a.goal}"` };
    const res = await toggleGoalCompleted({ id: g.id, completed: true });
    return { ok: res.ok, error: res.error };
  }

  if (a.type === 'update_goal') {
    const g = await findGoal(a.goal);
    if (!g) return { ok: false, error: `No encontré la meta "${a.goal}"` };
    const res = await updateGoal({
      id: g.id,
      ...(a.target !== undefined && { targetAmount: a.target }),
      ...(a.targetDate !== undefined && { targetDate: a.targetDate }),
    });
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

  if (a.type === 'create_month') {
    let cloneFromId: string | undefined;
    let incomeTotal = 0;
    if (a.copyFromMonth) {
      const cy = a.copyFromYear ?? a.year;
      const [src] = await db
        .select({ id: period.id, income: period.incomeTotal })
        .from(period)
        .where(
          and(
            eq(period.userId, session.userId),
            eq(period.year, cy),
            eq(period.month, a.copyFromMonth)
          )
        );
      if (!src) {
        return {
          ok: false,
          error: `No encontré el mes ${a.copyFromMonth}/${cy} para copiar`,
        };
      }
      cloneFromId = src.id;
      incomeTotal = src.income;
    }
    const res = await createPeriod({
      year: a.year,
      month: a.month,
      incomeTotal,
      cloneFromId,
    });
    return { ok: res.ok, error: res.error };
  }

  // contribute_goal
  const g = await findGoal(a.goal);
  if (!g) return { ok: false, error: `No encontré la meta "${a.goal}"` };
  const res = await contributeGoal({ id: g.id, amount: a.amount });
  return { ok: res.ok, error: res.error };
}
