import 'server-only';
import { db, eq, and, ne, asc, desc, period, category, expense } from '@/db';

export async function getPeriod(userId: string, periodId: string) {
  const [p] = await db
    .select()
    .from(period)
    .where(and(eq(period.id, periodId), eq(period.userId, userId)));
  return p ?? null;
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
