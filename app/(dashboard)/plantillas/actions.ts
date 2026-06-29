'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, expenseTemplate, category } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { addTemplateSchema, updateTemplateSchema } from './schema';

async function ownsCategory(userId: string, categoryId: string) {
  const [c] = await db
    .select({ id: category.id })
    .from(category)
    .where(and(eq(category.id, categoryId), eq(category.userId, userId)));
  return Boolean(c);
}

export async function addTemplate(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = addTemplateSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  if (!(await ownsCategory(session.userId, parsed.data.categoryId)))
    return UNAUTHORIZED;

  const existing = await db
    .select({ sortOrder: expenseTemplate.sortOrder })
    .from(expenseTemplate)
    .where(eq(expenseTemplate.userId, session.userId));
  const nextOrder = existing.reduce((m, t) => Math.max(m, t.sortOrder), -1) + 1;

  await db.insert(expenseTemplate).values({
    userId: session.userId,
    categoryId: parsed.data.categoryId,
    concept: parsed.data.concept,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    sortOrder: nextOrder,
  });

  revalidatePath('/plantillas');
  return ok();
}

export async function updateTemplate(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, ...fields } = parsed.data;

  if (fields.categoryId && !(await ownsCategory(session.userId, fields.categoryId)))
    return UNAUTHORIZED;

  const result = await db
    .update(expenseTemplate)
    .set(fields)
    .where(
      and(eq(expenseTemplate.id, id), eq(expenseTemplate.userId, session.userId))
    )
    .returning({ id: expenseTemplate.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidatePath('/plantillas');
  return ok();
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const result = await db
    .delete(expenseTemplate)
    .where(
      and(eq(expenseTemplate.id, id), eq(expenseTemplate.userId, session.userId))
    )
    .returning({ id: expenseTemplate.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidatePath('/plantillas');
  return ok();
}
