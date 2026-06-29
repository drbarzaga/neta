import 'server-only';
import { db, eq, desc, period, expense } from '@/db';
import { periodTotals, type PeriodTotals } from '@/lib/money';
import type { Period } from '@/db';

export interface PeriodWithTotals extends Period {
  totals: PeriodTotals;
  count: number;
}

export async function getPeriodsWithTotals(
  userId: string
): Promise<PeriodWithTotals[]> {
  const periods = await db
    .select()
    .from(period)
    .where(eq(period.userId, userId))
    .orderBy(desc(period.year), desc(period.month));

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
