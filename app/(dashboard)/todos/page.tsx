import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-server';
import { getOrCreateTodoColumns, getTodos, getTodoYears } from './queries';
import { TodosClient } from './_components/todos-client';

export const metadata: Metadata = { title: 'Todos — Neta' };

export default async function TodosPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { userId } = await requireSession();
  const { year: yearParam } = await searchParams;

  const currentYear = new Date().getFullYear();
  const year = yearParam ? Number(yearParam) || currentYear : currentYear;

  const [columns, todos, years] = await Promise.all([
    getOrCreateTodoColumns(userId),
    getTodos(userId, year),
    getTodoYears(userId, currentYear),
  ]);

  return <TodosClient columns={columns} todos={todos} years={years} year={year} />;
}
