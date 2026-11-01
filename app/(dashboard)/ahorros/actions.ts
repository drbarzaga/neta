'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, savingsAccount, savingsMovement } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { todayISO } from '@/lib/dates';
import { getLatestRate } from '@/lib/exchange-rate';
import {
  addSavingsMovementIfFunds,
  createSavingsAccountWithBalance,
  deleteManualSavingsMovement,
  transferSavingsIfFunds,
} from '@/lib/ledger';
import { getOrCreateUserSettings } from '../configuracion/queries';
import {
  createAccountSchema,
  updateAccountSchema,
  addMovementSchema,
  deleteMovementSchema,
  transferSchema,
} from './schema';

function revalidate() {
  revalidatePath('/ahorros');
  revalidatePath('/');
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function createSavingsAccount(
  input: unknown
): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const data = parsed.data;

  const existing = await db
    .select({ sortOrder: savingsAccount.sortOrder })
    .from(savingsAccount)
    .where(eq(savingsAccount.userId, session.userId));
  const nextOrder = existing.reduce((m, a) => Math.max(m, a.sortOrder), -1) + 1;

  // Saldo inicial: se registra como primer depósito para que quede en el historial.
  await createSavingsAccountWithBalance({
    userId: session.userId,
    name: data.name,
    icon: data.icon,
    color: data.color,
    currency: data.currency,
    balance: data.initialBalance,
    sortOrder: nextOrder,
    note: 'Saldo inicial',
    date: todayISO(),
  });

  revalidate();
  return ok();
}

export async function updateSavingsAccount(
  input: unknown
): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = updateAccountSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const { id, ...fields } = parsed.data;

  const result = await db
    .update(savingsAccount)
    .set(fields)
    .where(and(eq(savingsAccount.id, id), eq(savingsAccount.userId, session.userId)))
    .returning({ id: savingsAccount.id });
  if (result.length === 0) return UNAUTHORIZED;

  revalidate();
  return ok();
}

export async function deleteSavingsAccount(id: string): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  await db
    .delete(savingsAccount)
    .where(and(eq(savingsAccount.id, id), eq(savingsAccount.userId, session.userId)));

  revalidate();
  return ok();
}

/** Registra un depósito (+) o retiro (−) y ajusta el saldo del apartado. */
export async function addSavingsMovement(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = addMovementSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const { accountId, kind, amount, note, date } = parsed.data;

  const [acc] = await db
    .select({ id: savingsAccount.id })
    .from(savingsAccount)
    .where(and(eq(savingsAccount.id, accountId), eq(savingsAccount.userId, session.userId)));
  if (!acc) return UNAUTHORIZED;

  const applied = await addSavingsMovementIfFunds({
    userId: session.userId,
    accountId,
    amount: kind === 'withdraw' ? -amount : amount,
    note: note ?? null,
    date,
  });
  if (!applied) return fail('No tienes saldo suficiente para ese retiro');

  revalidate();
  return ok();
}

/**
 * Mueve plata entre dos apartados propios: resta del origen, suma al
 * destino (convertido a su moneda si difiere de la del origen) y deja un
 * movimiento en cada uno.
 */
export async function transferBetweenSavings(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  const { fromAccountId, toAccountId, amount, note, date } = parsed.data;

  const [from] = await db
    .select()
    .from(savingsAccount)
    .where(and(eq(savingsAccount.id, fromAccountId), eq(savingsAccount.userId, session.userId)));
  const [to] = await db
    .select()
    .from(savingsAccount)
    .where(and(eq(savingsAccount.id, toAccountId), eq(savingsAccount.userId, session.userId)));
  if (!from || !to) return UNAUTHORIZED;
  if (amount > from.balance) return fail('No tienes saldo suficiente para esa transferencia');

  let credited = amount;
  if (from.currency !== to.currency) {
    const settings = await getOrCreateUserSettings(session.userId);
    const rate = await getLatestRate(settings.country, settings.arCasa);
    const local = from.currency === 'USD' ? amount * rate : amount;
    credited = round2(to.currency === 'USD' ? (rate > 0 ? local / rate : 0) : local);
  }

  const applied = await transferSavingsIfFunds({
    userId: session.userId,
    fromAccountId,
    toAccountId,
    amount,
    credited,
    fromNote: note ? `A ${to.name}: ${note}` : `Transferencia a ${to.name}`,
    toNote: note ? `De ${from.name}: ${note}` : `Transferencia de ${from.name}`,
    date,
  });
  if (!applied) return fail('No tienes saldo suficiente para esa transferencia');

  revalidate();
  return ok();
}

/** Borra un movimiento y revierte su efecto en el saldo. */
export async function deleteSavingsMovement(
  input: unknown
): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = deleteMovementSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');

  const [m] = await db
    .select({ expenseId: savingsMovement.expenseId })
    .from(savingsMovement)
    .where(and(eq(savingsMovement.id, parsed.data.id), eq(savingsMovement.userId, session.userId)));
  if (!m) return UNAUTHORIZED;
  if (m.expenseId) {
    return fail('Este movimiento viene de un gasto vinculado; edítalo desde el mes.');
  }

  const deleted = await deleteManualSavingsMovement(session.userId, parsed.data.id);
  if (!deleted) return UNAUTHORIZED;

  revalidate();
  return ok();
}
