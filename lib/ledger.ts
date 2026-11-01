import 'server-only';
import { randomUUID } from 'node:crypto';
import {
  db,
  and,
  eq,
  sql,
  goal,
  savingsAccount,
  savingsMovement,
} from '@/db';

/**
 * Operaciones sobre saldos. El driver `neon-http` no admite transacciones
 * interactivas, así que para que nunca quede un movimiento sin su saldo:
 * - los incrementos se calculan en SQL, no leyendo el saldo antes;
 * - lo que va junto se ejecuta con `db.batch` (una transacción) o en una sola
 *   sentencia con CTE cuando depende de una condición, como tener fondos.
 */

type BatchQueries = Parameters<typeof db.batch>[0];

export function runBatch(queries: BatchQueries[number][]) {
  if (queries.length === 0) return Promise.resolve([]);
  return db.batch(queries as unknown as BatchQueries);
}

export function adjustSavingsBalanceQuery(userId: string, accountId: string, delta: number) {
  return db
    .update(savingsAccount)
    .set({ balance: sql`greatest(0, ${savingsAccount.balance} + ${delta})` })
    .where(and(eq(savingsAccount.id, accountId), eq(savingsAccount.userId, userId)));
}

export function adjustGoalSavedQuery(userId: string, goalId: string, delta: number) {
  return db
    .update(goal)
    .set({ savedAmount: sql`greatest(0, ${goal.savedAmount} + ${delta})` })
    .where(and(eq(goal.id, goalId), eq(goal.userId, userId)));
}

/** Registra un depósito (+) o retiro (−). Devuelve `false` si no hay fondos. */
export async function addSavingsMovementIfFunds(input: {
  userId: string;
  accountId: string;
  amount: number;
  note: string | null;
  date: string;
}): Promise<boolean> {
  const { userId, accountId, amount, note, date } = input;
  const { rows } = await db.execute(sql`
    with updated as (
      update savings_account
      set balance = balance + ${amount}::numeric
      where id = ${accountId}::uuid
        and user_id = ${userId}
        and balance + ${amount}::numeric >= 0
      returning id
    )
    insert into savings_movement (user_id, account_id, amount, note, date)
    select ${userId}, id, ${amount}::numeric, ${note}::text, ${date}::date
    from updated
    returning id
  `);
  return rows.length > 0;
}

/** Mueve fondos entre dos apartados. Devuelve `false` si el origen no alcanza. */
export async function transferSavingsIfFunds(input: {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  credited: number;
  fromNote: string;
  toNote: string;
  date: string;
}): Promise<boolean> {
  const { userId, fromAccountId, toAccountId, amount, credited, fromNote, toNote, date } = input;
  const { rows } = await db.execute(sql`
    with source as (
      update savings_account
      set balance = balance - ${amount}::numeric
      where id = ${fromAccountId}::uuid
        and user_id = ${userId}
        and balance >= ${amount}::numeric
      returning id
    ),
    target as (
      update savings_account
      set balance = balance + ${credited}::numeric
      where id = ${toAccountId}::uuid
        and user_id = ${userId}
        and exists (select 1 from source)
      returning id
    ),
    movements as (
      insert into savings_movement (user_id, account_id, amount, note, date)
      select ${userId}, id, ${-amount}::numeric, ${fromNote}::text, ${date}::date from source
      union all
      select ${userId}, id, ${credited}::numeric, ${toNote}::text, ${date}::date from target
      returning id
    )
    select id from source
  `);
  return rows.length > 0;
}

/** Borra un movimiento manual y revierte su efecto. `false` si no se borró nada. */
export async function deleteManualSavingsMovement(
  userId: string,
  movementId: string
): Promise<boolean> {
  const { rows } = await db.execute(sql`
    with deleted as (
      delete from savings_movement
      where id = ${movementId}::uuid
        and user_id = ${userId}
        and expense_id is null
      returning id, account_id, amount
    ),
    adjusted as (
      update savings_account a
      set balance = greatest(0, a.balance - d.amount)
      from deleted d
      where a.id = d.account_id
      returning a.id
    )
    select id from deleted
  `);
  return rows.length > 0;
}

/** Crea un apartado y, si tiene saldo inicial, su primer movimiento. */
export function createSavingsAccountWithBalance(input: {
  userId: string;
  name: string;
  icon: string;
  color: string;
  currency: string;
  balance: number;
  sortOrder: number;
  note: string;
  date: string;
}) {
  const { note, date, ...account } = input;
  const id = randomUUID();
  const insertAccount = db.insert(savingsAccount).values({ ...account, id });
  if (account.balance <= 0) return runBatch([insertAccount]);
  return runBatch([
    insertAccount,
    db.insert(savingsMovement).values({
      userId: account.userId,
      accountId: id,
      amount: account.balance,
      note,
      date,
    }),
  ]);
}

/**
 * Deposita el salario una sola vez por mes: marcar el mes como ejecutado y
 * acreditar van en la misma sentencia, así que un reintento del cron no duplica.
 */
export async function depositSalaryOnce(input: {
  depositId: string;
  userId: string;
  accountId: string;
  amount: number;
  note: string;
  date: string;
  year: number;
  month: number;
}): Promise<boolean> {
  const { depositId, userId, accountId, amount, note, date, year, month } = input;
  const { rows } = await db.execute(sql`
    with claimed as (
      update salary_deposit
      set last_run_year = ${year}::int, last_run_month = ${month}::int, last_run_at = now()
      where id = ${depositId}::uuid
        and (last_run_year is distinct from ${year}::int
          or last_run_month is distinct from ${month}::int)
      returning id
    ),
    credited as (
      update savings_account
      set balance = balance + ${amount}::numeric
      where id = ${accountId}::uuid
        and user_id = ${userId}
        and exists (select 1 from claimed)
      returning id
    ),
    movement as (
      insert into savings_movement (user_id, account_id, amount, note, date)
      select ${userId}, id, ${amount}::numeric, ${note}::text, ${date}::date from credited
      returning id
    )
    select id from credited
  `);
  return rows.length > 0;
}
