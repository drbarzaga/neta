'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, savingsAccount, savingsMovement } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { todayISO } from '@/lib/dates';
import {
  createAccountSchema,
  updateAccountSchema,
  addMovementSchema,
  deleteMovementSchema,
} from './schema';

function revalidate() {
  revalidatePath('/ahorros');
  revalidatePath('/');
}

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

  const [acc] = await db
    .insert(savingsAccount)
    .values({
      userId: session.userId,
      name: data.name,
      icon: data.icon,
      color: data.color,
      currency: data.currency,
      balance: data.initialBalance,
      sortOrder: nextOrder,
    })
    .returning({ id: savingsAccount.id });

  // Saldo inicial: se registra como primer depósito para que quede en el historial.
  if (data.initialBalance > 0) {
    await db.insert(savingsMovement).values({
      userId: session.userId,
      accountId: acc.id,
      amount: data.initialBalance,
      note: 'Saldo inicial',
      date: todayISO(),
    });
  }

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
    .select({ balance: savingsAccount.balance })
    .from(savingsAccount)
    .where(and(eq(savingsAccount.id, accountId), eq(savingsAccount.userId, session.userId)));
  if (!acc) return UNAUTHORIZED;

  const delta = kind === 'withdraw' ? -amount : amount;
  if (kind === 'withdraw' && amount > acc.balance) {
    return fail('No tienes saldo suficiente para ese retiro');
  }

  await db.insert(savingsMovement).values({
    userId: session.userId,
    accountId,
    amount: delta,
    note: note ?? null,
    date,
  });
  await db
    .update(savingsAccount)
    .set({ balance: acc.balance + delta })
    .where(and(eq(savingsAccount.id, accountId), eq(savingsAccount.userId, session.userId)));

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
    .select({ amount: savingsMovement.amount, accountId: savingsMovement.accountId })
    .from(savingsMovement)
    .where(and(eq(savingsMovement.id, parsed.data.id), eq(savingsMovement.userId, session.userId)));
  if (!m) return UNAUTHORIZED;

  const [acc] = await db
    .select({ balance: savingsAccount.balance })
    .from(savingsAccount)
    .where(eq(savingsAccount.id, m.accountId));

  await db.delete(savingsMovement).where(eq(savingsMovement.id, parsed.data.id));
  if (acc) {
    await db
      .update(savingsAccount)
      .set({ balance: Math.max(0, acc.balance - m.amount) })
      .where(eq(savingsAccount.id, m.accountId));
  }

  revalidate();
  return ok();
}
