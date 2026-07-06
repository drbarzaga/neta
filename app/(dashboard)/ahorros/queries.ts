import 'server-only';
import {
  db,
  eq,
  and,
  asc,
  desc,
  savingsAccount,
  savingsMovement,
  type SavingsAccount,
  type SavingsMovement,
} from '@/db';

/** Apartados de ahorro del usuario, por orden y fecha de creación. */
export async function getSavingsAccounts(
  userId: string
): Promise<SavingsAccount[]> {
  return db
    .select()
    .from(savingsAccount)
    .where(eq(savingsAccount.userId, userId))
    .orderBy(asc(savingsAccount.sortOrder), asc(savingsAccount.createdAt));
}

/** Todos los movimientos del usuario (para el gráfico y el historial). */
export async function getSavingsMovements(
  userId: string
): Promise<SavingsMovement[]> {
  return db
    .select()
    .from(savingsMovement)
    .where(eq(savingsMovement.userId, userId))
    .orderBy(desc(savingsMovement.date), desc(savingsMovement.createdAt));
}

/** Un apartado del usuario, o null si no existe / no le pertenece. */
export async function getSavingsAccount(
  userId: string,
  id: string
): Promise<SavingsAccount | null> {
  const [row] = await db
    .select()
    .from(savingsAccount)
    .where(and(eq(savingsAccount.id, id), eq(savingsAccount.userId, userId)));
  return row ?? null;
}
