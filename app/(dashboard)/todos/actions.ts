'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, todoColumn, todo } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import {
  createColumnSchema,
  updateColumnSchema,
  reorderColumnsSchema,
  createTodoSchema,
  updateTodoSchema,
  moveTodoSchema,
} from './schema';

function revalidate() {
  revalidatePath('/todos');
}

export async function createColumn(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = createColumnSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const data = parsed.data;

  const existing = await db
    .select({ sortOrder: todoColumn.sortOrder })
    .from(todoColumn)
    .where(eq(todoColumn.userId, session.userId));
  const nextOrder = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1;

  await db.insert(todoColumn).values({
    userId: session.userId,
    name: data.name,
    color: data.color,
    isDone: data.isDone,
    sortOrder: nextOrder,
  });

  revalidate();
  return ok();
}

export async function updateColumn(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = updateColumnSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const { id, ...fields } = parsed.data;

  const [before] = await db
    .select({ isDone: todoColumn.isDone })
    .from(todoColumn)
    .where(and(eq(todoColumn.id, id), eq(todoColumn.userId, session.userId)));
  if (!before) return UNAUTHORIZED;

  const result = await db
    .update(todoColumn)
    .set(fields)
    .where(and(eq(todoColumn.id, id), eq(todoColumn.userId, session.userId)))
    .returning({ id: todoColumn.id });
  if (result.length === 0) return UNAUTHORIZED;

  // Si cambió isDone, refleja el estado "completado" en los todos de la
  // columna (para la revisión de fin de año).
  if (fields.isDone !== undefined && fields.isDone !== before.isDone) {
    await db
      .update(todo)
      .set({ completedAt: fields.isDone ? new Date() : null })
      .where(and(eq(todo.columnId, id), eq(todo.userId, session.userId)));
  }

  revalidate();
  return ok();
}

export async function deleteColumn(id: string): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const [used] = await db
    .select({ id: todo.id })
    .from(todo)
    .where(and(eq(todo.columnId, id), eq(todo.userId, session.userId)))
    .limit(1);
  if (used) return fail('No se puede eliminar: tiene tareas asociadas. Muévelas primero.');

  const result = await db
    .delete(todoColumn)
    .where(and(eq(todoColumn.id, id), eq(todoColumn.userId, session.userId)))
    .returning({ id: todoColumn.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidate();
  return ok();
}

/** Reordena las columnas del usuario según la lista de ids. */
export async function reorderColumns(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = reorderColumnsSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');

  const owned = await db
    .select({ id: todoColumn.id })
    .from(todoColumn)
    .where(eq(todoColumn.userId, session.userId));
  const valid = new Set(owned.map((c) => c.id));

  let order = 0;
  for (const id of parsed.data.orderedIds) {
    if (!valid.has(id)) continue;
    await db
      .update(todoColumn)
      .set({ sortOrder: order++ })
      .where(and(eq(todoColumn.id, id), eq(todoColumn.userId, session.userId)));
  }

  revalidate();
  return ok();
}

export async function createTodo(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = createTodoSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const data = parsed.data;

  const [col] = await db
    .select({ isDone: todoColumn.isDone })
    .from(todoColumn)
    .where(and(eq(todoColumn.id, data.columnId), eq(todoColumn.userId, session.userId)));
  if (!col) return fail('Columna no encontrada');

  const existing = await db
    .select({ sortOrder: todo.sortOrder })
    .from(todo)
    .where(
      and(
        eq(todo.userId, session.userId),
        eq(todo.columnId, data.columnId),
        eq(todo.year, data.year)
      )
    );
  const nextOrder = existing.reduce((m, t) => Math.max(m, t.sortOrder), -1) + 1;

  await db.insert(todo).values({
    userId: session.userId,
    columnId: data.columnId,
    year: data.year,
    title: data.title,
    note: data.note ?? null,
    dueDate: data.dueDate ?? null,
    completedAt: col.isDone ? new Date() : null,
    sortOrder: nextOrder,
  });

  revalidate();
  return ok();
}

export async function updateTodo(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = updateTodoSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const { id, ...fields } = parsed.data;

  const result = await db
    .update(todo)
    .set(fields)
    .where(and(eq(todo.id, id), eq(todo.userId, session.userId)))
    .returning({ id: todo.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidate();
  return ok();
}

export async function deleteTodo(id: string): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const result = await db
    .delete(todo)
    .where(and(eq(todo.id, id), eq(todo.userId, session.userId)))
    .returning({ id: todo.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidate();
  return ok();
}

/**
 * Mueve un todo a `columnId` (destino, puede ser la misma columna) y fija el
 * orden final de esa columna a partir de `orderedIds`. Fija/limpia
 * `completedAt` según si la columna destino está marcada como "hecho".
 */
export async function moveTodo(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = moveTodoSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  const { id, columnId, orderedIds } = parsed.data;

  const [col] = await db
    .select({ isDone: todoColumn.isDone })
    .from(todoColumn)
    .where(and(eq(todoColumn.id, columnId), eq(todoColumn.userId, session.userId)));
  if (!col) return fail('Columna no encontrada');

  const moved = await db
    .update(todo)
    .set({ columnId, completedAt: col.isDone ? new Date() : null })
    .where(and(eq(todo.id, id), eq(todo.userId, session.userId)))
    .returning({ id: todo.id });
  if (moved.length === 0) return UNAUTHORIZED;

  const owned = await db
    .select({ id: todo.id })
    .from(todo)
    .where(
      and(
        eq(todo.userId, session.userId),
        eq(todo.columnId, columnId)
      )
    );
  const valid = new Set(owned.map((t) => t.id));

  let order = 0;
  for (const tid of orderedIds) {
    if (!valid.has(tid)) continue;
    await db
      .update(todo)
      .set({ sortOrder: order++ })
      .where(and(eq(todo.id, tid), eq(todo.userId, session.userId)));
  }

  revalidate();
  return ok();
}
