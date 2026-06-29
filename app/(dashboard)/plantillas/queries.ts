import 'server-only';
import { db, eq, asc, expenseTemplate, category } from '@/db';

export interface TemplateRow {
  id: string;
  concept: string;
  amount: number;
  currency: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
}

export async function getTemplatesWithCategory(
  userId: string
): Promise<TemplateRow[]> {
  return db
    .select({
      id: expenseTemplate.id,
      concept: expenseTemplate.concept,
      amount: expenseTemplate.amount,
      currency: expenseTemplate.currency,
      categoryId: expenseTemplate.categoryId,
      categoryName: category.name,
      categoryColor: category.color,
      categoryIcon: category.icon,
    })
    .from(expenseTemplate)
    .innerJoin(category, eq(expenseTemplate.categoryId, category.id))
    .where(eq(expenseTemplate.userId, userId))
    .orderBy(asc(category.sortOrder), asc(expenseTemplate.sortOrder));
}
