import 'server-only';
import { db, eq, and, desc, asc, period, expense } from '@/db';
import { periodTotals, type PeriodTotals } from '@/lib/money';
import type { Period } from '@/db';

export interface PeriodWithTotals extends Period {
  totals: PeriodTotals;
  count: number;
}

export async function getPeriodsWithTotals(
  userId: string,
  year?: number
): Promise<PeriodWithTotals[]> {
  const periods = await db
    .select()
    .from(period)
    .where(
      year ? and(eq(period.userId, userId), eq(period.year, year)) : eq(period.userId, userId)
    )
    // Filtrado a un año: orden cronológico (enero a diciembre). Sin filtro
    // (dashboard, analítica): más reciente primero, como esperan esas vistas.
    .orderBy(desc(period.year), year ? asc(period.month) : desc(period.month));

  const allExpenses = await db
    .select({
      periodId: expense.periodId,
      amount: expense.amount,
      currency: expense.currency,
      status: expense.status,
      categoryId: expense.categoryId,
    })
    .from(expense)
    .where(eq(expense.userId, userId));

  return periods.map((p) => {
    const exps = allExpenses.filter((e) => e.periodId === p.id);
    return {
      ...p,
      totals: periodTotals(exps, p.dollarRate, p.incomeTotal),
      count: exps.length,
    };
  });
}

/** Id + label de todos los meses (todos los años), para el selector "duplicar desde". */
export async function getAllPeriodLabels(
  userId: string
): Promise<{ id: string; label: string }[]> {
  return db
    .select({ id: period.id, label: period.label })
    .from(period)
    .where(eq(period.userId, userId))
    .orderBy(desc(period.year), desc(period.month));
}

/** Años con al menos un mes, más el año actual (para poder crear el primero). */
export async function getPeriodYears(userId: string, currentYear: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ year: period.year })
    .from(period)
    .where(eq(period.userId, userId));
  const years = new Set(rows.map((r) => r.year));
  years.add(currentYear);
  return Array.from(years).sort((a, b) => b - a);
}
