'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, category, expense } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import {
  addCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
} from './schema';

function revalidate() {
  revalidatePath('/categorias');
  revalidatePath('/');
  revalidatePath('/analitica');
  revalidatePath('/meses', 'layout');
}

/** Reordena las categorías del usuario según la lista de ids. */
export async function reorderCategories(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = reorderCategoriesSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');

  const owned = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.userId, session.userId));
  const valid = new Set(owned.map((c) => c.id));

  let order = 0;
  for (const id of parsed.data.orderedIds) {
    if (!valid.has(id)) continue;
    await db
      .update(category)
      .set({ sortOrder: order++ })
      .where(and(eq(category.id, id), eq(category.userId, session.userId)));
  }

  revalidate();
  return ok();
}

export async function addCategory(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = addCategorySchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');

  const existing = await db
    .select({ sortOrder: category.sortOrder })
    .from(category)
    .where(eq(category.userId, session.userId));
  const nextOrder = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1;

  await db.insert(category).values({
    userId: session.userId,
    name: parsed.data.name,
    color: parsed.data.color,
    icon: parsed.data.icon,
    sortOrder: nextOrder,
  });

  revalidate();
  return ok();
}

export async function updateCategory(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, ...fields } = parsed.data;

  const result = await db
    .update(category)
    .set(fields)
    .where(and(eq(category.id, id), eq(category.userId, session.userId)))
    .returning({ id: category.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidate();
  return ok();
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const [used] = await db
    .select({ id: expense.id })
    .from(expense)
    .where(and(eq(expense.categoryId, id), eq(expense.userId, session.userId)))
    .limit(1);
  if (used) return fail('No se puede eliminar: tiene gastos asociados');

  const result = await db
    .delete(category)
    .where(and(eq(category.id, id), eq(category.userId, session.userId)))
    .returning({ id: category.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidate();
  return ok();
}
