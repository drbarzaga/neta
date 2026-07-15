import 'server-only';
import { cache } from 'react';
import {
  db,
  eq,
  and,
  asc,
  todoColumn,
  todo,
  type TodoColumn,
  type Todo,
} from '@/db';

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

/** Todos del usuario para un año dado, ordenados por posición dentro de su columna. */
export async function getTodos(userId: string, year: number): Promise<Todo[]> {
  return db
    .select()
    .from(todo)
    .where(and(eq(todo.userId, userId), eq(todo.year, year)))
    .orderBy(asc(todo.sortOrder), asc(todo.createdAt));
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
