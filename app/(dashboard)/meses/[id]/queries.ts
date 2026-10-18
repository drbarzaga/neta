import 'server-only';
import { db, eq, and, or, ne, lt, gt, asc, desc, period, category, expense } from '@/db';

export async function getPeriod(userId: string, periodId: string) {
  const [p] = await db
    .select()
    .from(period)
    .where(and(eq(period.id, periodId), eq(period.userId, userId)));
  return p ?? null;
}

/** Mes inmediatamente anterior/siguiente en el tiempo (año/mes), para navegar entre meses. */
export async function getAdjacentPeriods(userId: string, year: number, month: number) {
  const [[prev], [next]] = await Promise.all([
    db
      .select({ id: period.id, label: period.label })
      .from(period)
      .where(
        and(
          eq(period.userId, userId),
          or(lt(period.year, year), and(eq(period.year, year), lt(period.month, month)))
        )
      )
      .orderBy(desc(period.year), desc(period.month))
      .limit(1),
    db
      .select({ id: period.id, label: period.label })
      .from(period)
      .where(
        and(
          eq(period.userId, userId),
          or(gt(period.year, year), and(eq(period.year, year), gt(period.month, month)))
        )
      )
      .orderBy(asc(period.year), asc(period.month))
      .limit(1),
  ]);
  return { prev: prev ?? null, next: next ?? null };
}

/** Otros meses del usuario (para mover/posponer un gasto), del más reciente. */
export async function getOtherPeriods(userId: string, periodId: string) {
  return db
    .select({ id: period.id, label: period.label })
    .from(period)
    .where(and(eq(period.userId, userId), ne(period.id, periodId)))
    .orderBy(desc(period.year), desc(period.month));
}

export async function getCategories(userId: string) {
  return db
    .select()
    .from(category)
    .where(eq(category.userId, userId))
    .orderBy(asc(category.sortOrder), asc(category.name));
}

export async function getExpenses(userId: string, periodId: string) {
  return db
    .select()
    .from(expense)
    .where(and(eq(expense.userId, userId), eq(expense.periodId, periodId)))
    .orderBy(asc(expense.sortOrder), asc(expense.createdAt));
}
