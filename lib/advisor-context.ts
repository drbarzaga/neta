import 'server-only';
import {
  db,
  eq,
  desc,
  asc,
  period,
  expense,
  category,
  goal,
  goalContribution,
} from '@/db';
import { periodTotals, formatMoney } from '@/lib/money';

const MAX_PERIODS = 12;

/**
 * Arma un resumen en texto de la situación financiera del usuario para dárselo
 * al asesor como contexto. Incluye los últimos meses con sus totales, el
 * desglose por categoría y la lista de gastos.
 */
export async function buildFinancialContext(userId: string): Promise<{
  hasData: boolean;
  context: string;
}> {
  const [periods, cats, goals, contributions] = await Promise.all([
    db
      .select()
      .from(period)
      .where(eq(period.userId, userId))
      .orderBy(desc(period.year), desc(period.month))
      .limit(MAX_PERIODS),
    db
      .select()
      .from(category)
      .where(eq(category.userId, userId))
      .orderBy(asc(category.sortOrder)),
    db
      .select()
      .from(goal)
      .where(eq(goal.userId, userId))
      .orderBy(asc(goal.sortOrder)),
    db
      .select({
        goalId: goalContribution.goalId,
        amount: goalContribution.amount,
        createdAt: goalContribution.createdAt,
      })
      .from(goalContribution)
      .where(eq(goalContribution.userId, userId)),
  ]);

  if (periods.length === 0) {
    return { hasData: false, context: 'El usuario todavía no creó ningún mes.' };
  }

  const catName = new Map(cats.map((c) => [c.id, c.name]));

  // Traemos todos los gastos de los meses considerados en una sola consulta.
  const allExpenses = await db
    .select()
    .from(expense)
    .where(eq(expense.userId, userId));
  const byPeriod = new Map<string, typeof allExpenses>();
  for (const e of allExpenses) {
    if (!byPeriod.has(e.periodId)) byPeriod.set(e.periodId, []);
    byPeriod.get(e.periodId)!.push(e);
  }

  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`Fecha de hoy: ${today}.`, ''];

  if (cats.length > 0) {
    lines.push(
      `Categorías del usuario (usa estos nombres exactos): ${cats
        .map((c) => c.name)
        .join(', ')}.`,
      ''
    );
  }

  if (goals.length > 0) {
    // Ritmo de ahorro por meta: aporte mensual promedio a partir del historial.
    const byGoal = new Map<string, { total: number; first: Date; count: number }>();
    for (const c of contributions) {
      if (c.amount <= 0) continue; // ignoramos correcciones negativas
      const acc = byGoal.get(c.goalId);
      if (acc) {
        acc.total += c.amount;
        acc.count += 1;
        if (c.createdAt < acc.first) acc.first = c.createdAt;
      } else {
        byGoal.set(c.goalId, { total: c.amount, first: c.createdAt, count: 1 });
      }
    }

    lines.push('Metas del usuario:');
    for (const g of goals) {
      const cur = g.currency;
      const money = (n: number) => formatMoney(n, cur, 'es-UY');
      let extra = g.completed ? ' (completada)' : '';
      if (!g.completed) {
        const remaining = Math.max(0, g.targetAmount - g.savedAmount);
        const stats = byGoal.get(g.id);
        // Meses transcurridos desde el primer aporte (mínimo 1).
        const months = stats
          ? Math.max(1, Math.round((Date.now() - stats.first.getTime()) / (1000 * 60 * 60 * 24 * 30)))
          : 0;
        const perMonth = stats && months > 0 ? stats.total / months : 0;
        const parts: string[] = [`faltan ${money(remaining)}`];
        if (perMonth > 0) {
          parts.push(`ritmo ~${money(perMonth)}/mes`);
          const monthsLeft = Math.ceil(remaining / perMonth);
          if (remaining > 0) parts.push(`a este ritmo ~${monthsLeft} mes(es)`);
        }
        if (g.targetDate) parts.push(`objetivo ${g.targetDate}`);
        extra = ` — ${parts.join(', ')}`;
      }
      lines.push(
        `- ${g.title}: ${money(g.savedAmount)} de ${money(g.targetAmount)}${extra}`
      );
    }
    lines.push('');
  }

  lines.push(
    `Meses disponibles (del más reciente al más antiguo, máximo ${MAX_PERIODS}):`,
    ''
  );

  for (const p of periods) {
    const items = byPeriod.get(p.id) ?? [];
    const locale = 'es-UY';
    const cur = p.localCurrency;
    const t = periodTotals(items, p.dollarRate, p.incomeTotal);
    const money = (n: number) => formatMoney(n, cur, locale);

    lines.push(`## ${p.label} — ${p.status === 'open' ? 'abierto' : 'cerrado'}`);
    lines.push(
      `Ingreso: ${money(p.incomeTotal)} | Gastado: ${money(t.totalLocal)} (${t.pctUsado.toFixed(0)}% del ingreso) | Restante: ${money(t.restante)} | Pagado: ${money(t.pagadoLocal)} | Pendiente: ${money(t.pendienteLocal)} | Cotización USD: ${p.dollarRate || 'sin definir'}`
    );

    // Desglose por categoría (solo las que tienen gasto).
    const cats = Object.entries(t.byCategory)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    if (cats.length > 0) {
      lines.push('Por categoría:');
      for (const [catId, v] of cats) {
        const pct = t.totalLocal > 0 ? (v / t.totalLocal) * 100 : 0;
        lines.push(`- ${catName.get(catId) ?? 'Sin categoría'}: ${money(v)} (${pct.toFixed(0)}%)`);
      }
    }

    if (items.length > 0) {
      lines.push('Gastos:');
      for (const e of items) {
        const venc = e.dueDate ? ` vence ${e.dueDate}` : '';
        lines.push(
          `- ${e.concept}: ${formatMoney(e.amount, e.currency, locale)} [${e.status}]${venc} (${catName.get(e.categoryId) ?? 'Sin categoría'})`
        );
      }
    }
    lines.push('');
  }

  return { hasData: true, context: lines.join('\n') };
}

export type InsightLevel = 'ok' | 'warn' | 'alert';
export interface AdvisorInsight {
  level: InsightLevel;
  text: string;
}

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Chequeo rápido de salud financiera (determinista, sin IA) sobre el mes más
 * reciente y las metas. Se muestra al abrir el asesor como resumen proactivo.
 */
export async function buildAdvisorInsights(
  userId: string
): Promise<AdvisorInsight[]> {
  const [latest] = await db
    .select()
    .from(period)
    .where(eq(period.userId, userId))
    .orderBy(desc(period.year), desc(period.month))
    .limit(1);

  if (!latest) {
    return [
      { level: 'warn', text: 'Todavía no creaste ningún mes. Empieza creando uno.' },
    ];
  }

  const items = await db
    .select()
    .from(expense)
    .where(eq(expense.periodId, latest.id));
  const t = periodTotals(items, latest.dollarRate, latest.incomeTotal);
  const cur = latest.localCurrency;
  const money = (n: number) => formatMoney(n, cur, 'es-UY');
  const insights: AdvisorInsight[] = [];

  // Uso del ingreso.
  if (latest.incomeTotal > 0) {
    if (t.pctUsado > 100) {
      insights.push({
        level: 'alert',
        text: `En ${latest.label} tus gastos superan tu ingreso (${t.pctUsado.toFixed(0)}%). Te faltan ${money(Math.abs(t.restante))}.`,
      });
    } else if (t.pctUsado >= 85) {
      insights.push({
        level: 'warn',
        text: `Vas al ${t.pctUsado.toFixed(0)}% de tu ingreso en ${latest.label}. Te queda ${money(t.restante)}.`,
      });
    } else {
      insights.push({
        level: 'ok',
        text: `Vas bien: usaste ${t.pctUsado.toFixed(0)}% del ingreso, te queda ${money(t.restante)}.`,
      });
    }
  }

  // Vencimientos.
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 3 * DAY_MS).toISOString().slice(0, 10);
  const overdue = items.filter(
    (e) => e.status !== 'pagado' && e.dueDate && e.dueDate < today
  );
  const upcoming = items.filter(
    (e) => e.status !== 'pagado' && e.dueDate && e.dueDate >= today && e.dueDate <= soon
  );
  if (overdue.length > 0) {
    insights.push({
      level: 'alert',
      text:
        overdue.length === 1
          ? `Tienes un gasto vencido sin pagar: ${overdue[0].concept}.`
          : `Tienes ${overdue.length} gastos vencidos sin pagar.`,
    });
  }
  if (upcoming.length > 0) {
    insights.push({
      level: 'warn',
      text:
        upcoming.length === 1
          ? `Vence pronto: ${upcoming[0].concept} (${upcoming[0].dueDate}).`
          : `${upcoming.length} gastos vencen en los próximos 3 días.`,
    });
  }

  // Metas con fecha objetivo vencida.
  const overdueGoals = goalsWithPassedTarget(
    await db
      .select({
        title: goal.title,
        targetDate: goal.targetDate,
        completed: goal.completed,
      })
      .from(goal)
      .where(eq(goal.userId, userId)),
    today
  );
  for (const g of overdueGoals) {
    insights.push({
      level: 'warn',
      text: `La meta "${g}" pasó su fecha objetivo y no está completada.`,
    });
  }

  return insights;
}

function goalsWithPassedTarget(
  goals: { title: string; targetDate: string | null; completed: boolean }[],
  today: string
): string[] {
  return goals
    .filter((g) => !g.completed && g.targetDate && g.targetDate < today)
    .map((g) => g.title);
}
