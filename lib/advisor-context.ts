import 'server-only';
import { db, eq, desc, asc, period, expense, category, goal } from '@/db';
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
  const [periods, cats, goals] = await Promise.all([
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
    lines.push('Metas del usuario:');
    for (const g of goals) {
      const cur = g.currency;
      lines.push(
        `- ${g.title}: ${formatMoney(g.savedAmount, cur, 'es-UY')} de ${formatMoney(g.targetAmount, cur, 'es-UY')}${g.completed ? ' (completada)' : ''}`
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
