import 'server-only';
import { cache } from 'react';
import {
  db,
  eq,
  and,
  asc,
  inArray,
  todoColumn,
  todo,
  todoItem,
  type TodoColumn,
  type Todo,
  type TodoItem,
} from '@/db';

export interface TodoWithItems extends Todo {
  items: TodoItem[];
}

const DEFAULT_COLUMNS = [
  { name: 'Por hacer', color: '#93c5fd', isDone: false },
  { name: 'En progreso', color: '#fcd34d', isDone: false },
  { name: 'Hecho', color: '#86efac', isDone: true },
];

/** Columnas del tablero de Todos, creando las de por defecto si el usuario no tiene ninguna. */
export const getOrCreateTodoColumns = cache(async function (
  userId: string
): Promise<TodoColumn[]> {
  const existing = await db
    .select()
    .from(todoColumn)
    .where(eq(todoColumn.userId, userId))
    .orderBy(asc(todoColumn.sortOrder), asc(todoColumn.createdAt));
  if (existing.length > 0) return existing;

  const created = await db
    .insert(todoColumn)
    .values(DEFAULT_COLUMNS.map((c, i) => ({ userId, ...c, sortOrder: i })))
    .returning();
  return created.sort((a, b) => a.sortOrder - b.sortOrder);
});

/**
 * Todos del usuario para un año dado, con su lista de verificación, ordenados
 * por posición dentro de su columna (y los ítems por su propio orden).
 */
export async function getTodos(userId: string, year: number): Promise<TodoWithItems[]> {
  const rows = await db
    .select()
    .from(todo)
    .where(and(eq(todo.userId, userId), eq(todo.year, year)))
    .orderBy(asc(todo.sortOrder), asc(todo.createdAt));
  if (rows.length === 0) return [];

  const items = await db
    .select()
    .from(todoItem)
    .where(
      and(
        eq(todoItem.userId, userId),
        inArray(
          todoItem.todoId,
          rows.map((t) => t.id)
        )
      )
    )
    .orderBy(asc(todoItem.sortOrder), asc(todoItem.createdAt));

  const byTodo = new Map<string, TodoItem[]>();
  for (const i of items) {
    if (!byTodo.has(i.todoId)) byTodo.set(i.todoId, []);
    byTodo.get(i.todoId)!.push(i);
  }
  return rows.map((t) => ({ ...t, items: byTodo.get(t.id) ?? [] }));
}

/** Años con al menos un todo, más el año dado (para que el selector siempre lo incluya). */
export async function getTodoYears(
  userId: string,
  currentYear: number
): Promise<number[]> {
  const rows = await db
    .selectDistinct({ year: todo.year })
    .from(todo)
    .where(eq(todo.userId, userId));
  const years = new Set(rows.map((r) => r.year));
  years.add(currentYear);
  return Array.from(years).sort((a, b) => b - a);
}
