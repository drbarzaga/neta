import type { SavingsAccount, SavingsMovement } from '@/db';

export interface SavingsState {
  accounts: SavingsAccount[];
  movements: SavingsMovement[];
}

export type SavingsOptimisticAction =
  | { type: 'remove-account'; id: string }
  | { type: 'add-movement'; movement: SavingsMovement }
  | { type: 'remove-movement'; id: string };

const OPTIMISTIC_PREFIX = 'optimistic-';

/** Movimiento provisional; el servidor lo reemplaza por el real al revalidar. */
export function createOptimisticMovement(
  fields: Pick<SavingsMovement, 'accountId' | 'amount' | 'note' | 'date'>
): SavingsMovement {
  return {
    ...fields,
    id: `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`,
    userId: '',
    expenseId: null,
    createdAt: new Date(),
  };
}

export function isOptimisticMovement(movement: SavingsMovement): boolean {
  return movement.id.startsWith(OPTIMISTIC_PREFIX);
}

/** Replica los efectos de las acciones de ahorros sobre saldos y movimientos. */
export function applySavingsOptimistic(
  state: SavingsState,
  action: SavingsOptimisticAction
): SavingsState {
  switch (action.type) {
    case 'remove-account':
      return {
        accounts: state.accounts.filter((a) => a.id !== action.id),
        movements: state.movements.filter((m) => m.accountId !== action.id),
      };
    case 'add-movement': {
      const { movement } = action;
      // El servidor ordena del más reciente al más antiguo.
      const index = state.movements.findIndex((m) => m.date <= movement.date);
      const at = index === -1 ? state.movements.length : index;
      return {
        accounts: state.accounts.map((a) =>
          a.id === movement.accountId ? { ...a, balance: a.balance + movement.amount } : a
        ),
        movements: [...state.movements.slice(0, at), movement, ...state.movements.slice(at)],
      };
    }
    case 'remove-movement': {
      const movement = state.movements.find((m) => m.id === action.id);
      if (!movement) return state;
      return {
        accounts: state.accounts.map((a) =>
          a.id === movement.accountId
            ? { ...a, balance: Math.max(0, a.balance - movement.amount) }
            : a
        ),
        movements: state.movements.filter((m) => m.id !== action.id),
      };
    }
  }
}
