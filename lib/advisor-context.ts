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
  purchase,
  savingsAccount,
  trip,
  tripExpense,
} from '@/db';
import { periodTotals, tripTotals, toUsd, toLocal, formatMoney } from '@/lib/money';
import { addMonths, periodLabel } from '@/lib/dates';
import { getCountry } from '@/lib/countries';
import { getLatestRate } from '@/lib/exchange-rate';
import { TRIP_STATUS_LABEL } from '@/app/(dashboard)/viajes/schema';

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
  const [periods, cats, goals, contributions, purchases, savings, trips, tripExpenses] =
    await Promise.all([
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
      db.select().from(purchase).where(eq(purchase.userId, userId)),
      db.select().from(savingsAccount).where(eq(savingsAccount.userId, userId)),
      db
        .select()
        .from(trip)
        .where(eq(trip.userId, userId))
        .orderBy(asc(trip.sortOrder)),
      db.select().from(tripExpense).where(eq(tripExpense.userId, userId)),
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

  if (savings.length > 0) {
    // Total ahorrado convertido a moneda local con la cotización del mes reciente.
    const rate = periods[0]?.dollarRate ?? 0;
    const totalLocal = savings.reduce(
      (s, a) => s + (a.currency === 'USD' ? a.balance * rate : a.balance),
      0
    );
    const localCur = periods[0]?.localCurrency ?? 'UYU';
    lines.push('Ahorros del usuario (apartados):');
    for (const a of savings) {
      lines.push(`- ${a.name}: ${formatMoney(a.balance, a.currency, 'es-UY')}`);
    }
    lines.push(
      `Total ahorrado (aprox. en ${localCur}): ${formatMoney(totalLocal, localCur, 'es-UY')}.`,
      'Nota: los ahorros son independientes de las metas; puedes sugerir mover ahorro hacia metas o comentar su evolución.',
      ''
    );
  }

  if (trips.length > 0) {
    const byTrip = new Map<string, typeof tripExpenses>();
    for (const e of tripExpenses) {
      if (!byTrip.has(e.tripId)) byTrip.set(e.tripId, []);
      byTrip.get(e.tripId)!.push(e);
    }

    // Cotización del país de cada destino (vía dolarapi), para el desglose en
    // moneda local del lugar. Se trae una sola vez por país.
    const destCountries = [...new Set(trips.map((t) => t.destinationCountry).filter((c): c is string => !!c))];
    const destRates = new Map(
      await Promise.all(
        destCountries.map(async (c) => [c, await getLatestRate(c)] as const)
      )
    );

    lines.push('Viajes del usuario:');
    for (const t of trips) {
      const items = byTrip.get(t.id) ?? [];
      const totals = tripTotals(items, t.dollarRate, t.budget);
      const money = (n: number) => formatMoney(n, t.currency, 'es-UY');
      const parts: string[] = [
        `pagado ${money(totals.paidLocal)}`,
        `planeado ${money(totals.plannedLocal)}`,
      ];
      if (t.budget > 0) {
        parts.push(`presupuesto ${money(t.budget)}`, `restante ${money(totals.remainingLocal)}`);
      }
      const dates =
        t.startDate || t.endDate
          ? ` (${t.startDate ?? '?'} a ${t.endDate ?? '?'})`
          : '';
      lines.push(
        `- ${t.name}${t.destination ? ` a ${t.destination}` : ''}${dates} — ${TRIP_STATUS_LABEL[t.status]}: ${parts.join(', ')}`
      );

      // Desglose en la moneda del país de destino (si se definió y difiere de la del viaje).
      const destCountry = t.destinationCountry ? getCountry(t.destinationCountry) : null;
      const destRate = t.destinationCountry ? destRates.get(t.destinationCountry) : undefined;
      if (destCountry && destRate && destCountry.currency !== t.currency) {
        const toDest = (n: number) =>
          toLocal({ amount: toUsd({ amount: n, currency: t.currency }, t.dollarRate), currency: 'USD' }, destRate);
        const moneyDest = (n: number) => formatMoney(toDest(n), destCountry.currency, destCountry.locale);
        lines.push(
          `  En ${destCountry.currency} (moneda de ${destCountry.name}): pagado ${moneyDest(totals.paidLocal)}, planeado ${moneyDest(totals.plannedLocal)}${t.budget > 0 ? `, presupuesto ${moneyDest(t.budget)}, restante ${moneyDest(totals.remainingLocal)}` : ''}.`
        );
      }

      if (items.length > 0) {
        for (const e of items) {
          lines.push(
            `  · ${e.concept}: ${formatMoney(e.amount, e.currency, 'es-UY')} [${e.paid ? 'pagado' : 'planeado'}] (${e.category})`
          );
        }
      }
    }
    lines.push('');
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
        const flags: string[] = [];
        if (e.recurring) flags.push('recurrente');
        if (e.installmentNumber && e.installmentsCount)
          flags.push(`cuota ${e.installmentNumber}/${e.installmentsCount}`);
        const tag = flags.length ? ` {${flags.join(', ')}}` : '';
        lines.push(
          `- ${e.concept}: ${formatMoney(e.amount, e.currency, locale)} [${e.status}]${venc} (${catName.get(e.categoryId) ?? 'Sin categoría'})${tag}`
        );
      }
    }
    lines.push('');
  }

  // Resumen de gastos recurrentes (según el mes más reciente).
  const latestPeriod = periods[0];
  const latestItems = latestPeriod ? (byPeriod.get(latestPeriod.id) ?? []) : [];
  const recurringConcepts = latestItems
    .filter((e) => e.recurring)
    .map((e) => e.concept);
  if (recurringConcepts.length > 0) {
    lines.push(
      `Gastos recurrentes (se agregan cada mes): ${recurringConcepts.join(', ')}.`,
      ''
    );
  }

  // Compras en cuotas activas (con cuotas pendientes de pagar).
  if (purchases.length > 0) {
    const paidByPurchase = new Map<string, number>();
    for (const e of allExpenses) {
      if (e.purchaseId && e.status === 'pagado') {
        paidByPurchase.set(e.purchaseId, (paidByPurchase.get(e.purchaseId) ?? 0) + 1);
      }
    }
    const active = purchases
      .map((pl) => {
        const paid = paidByPurchase.get(pl.id) ?? 0;
        const remaining = Math.max(0, pl.installmentsCount - paid);
        const end = addMonths(pl.startMonth, pl.startYear, pl.installmentsCount - 1);
        return { pl, paid, remaining, end };
      })
      .filter((x) => x.remaining > 0);

    if (active.length > 0) {
      lines.push('Compras en cuotas activas:');
      for (const { pl, paid, remaining, end } of active) {
        const m = (n: number) => formatMoney(n, pl.currency, 'es-UY');
        lines.push(
          `- ${pl.concept}: ${m(pl.installmentAmount)}/mes, ${paid} de ${pl.installmentsCount} cuotas pagadas, quedan ${remaining} (hasta ${periodLabel(end.month, end.year)})`
        );
      }
      lines.push('');
    }
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

  // Compromiso mensual por compras en cuotas de este mes (cuotas sin pagar).
  const pendingInstallments = items.filter(
    (e) => e.installmentNumber && e.status !== 'pagado'
  );
  if (pendingInstallments.length > 0) {
    const totalLocal = pendingInstallments.reduce(
      (s, e) => s + (e.currency === 'USD' ? e.amount * latest.dollarRate : e.amount),
      0
    );
    insights.push({
      level: 'warn',
      text: `Tienes ${pendingInstallments.length} cuota(s) por pagar este mes (${money(totalLocal)}).`,
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
