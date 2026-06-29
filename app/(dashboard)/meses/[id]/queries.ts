import 'server-only';
import { db, eq, and, asc, period, category, expense } from '@/db';

export async function getPeriod(userId: string, periodId: string) {
  const [p] = await db
    .select()
    .from(period)
    .where(and(eq(period.id, periodId), eq(period.userId, userId)));
  return p ?? null;
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
