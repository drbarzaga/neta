'use client';

import { createContext, use } from 'react';
import type { Expense } from '@/db';

export type ExpenseOptimisticAction =
  | { type: 'patch'; id: string; fields: Partial<Expense> }
  | { type: 'remove'; id: string };

/** Aplica un cambio al listado antes de que el servidor lo confirme. */
export function applyExpenseOptimistic(
  list: Expense[],
  action: ExpenseOptimisticAction
): Expense[] {
  if (action.type === 'remove') return list.filter((e) => e.id !== action.id);
  return list.map((e) => (e.id === action.id ? { ...e, ...action.fields } : e));
}

export const ExpenseOptimisticContext = createContext<
  (action: ExpenseOptimisticAction) => void
>(() => {});

/** Debe llamarse dentro de una transición (`useOptimistic` lo exige). */
export function useExpenseOptimistic() {
  return use(ExpenseOptimisticContext);
}
