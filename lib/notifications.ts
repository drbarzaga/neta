import 'server-only';
import {
  db,
  eq,
  and,
  ne,
  gte,
  lte,
  isNull,
  isNotNull,
  user,
  period,
  expense,
  category,
  emailPreference,
  todo,
  salaryDeposit,
  savingsAccount,
  savingsMovement,
  userSettings,
  vehicleExpense,
} from '@/db';
import { periodTotals, formatUSD, formatMoney } from '@/lib/money';
import { todayISO, nowInTimezone, resolveSalaryDepositDay, periodLabel } from '@/lib/dates';
import { getCountry } from '@/lib/countries';
import { sendEmail } from '@/lib/email';
import { DueReminderEmail, type DueItem } from '@/emails/due-reminder';
import { MonthlySummaryEmail } from '@/emails/monthly-summary';
import { BudgetAlertEmail } from '@/emails/budget-alert';
import { TodoDueReminderEmail, type TodoDueItem } from '@/emails/todo-due-reminder';

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Avisos de gastos próximos a vencer, según las preferencias de cada usuario. */
export async function runDueReminders(): Promise<{ sent: number }> {
  const prefs = await db
    .select({
      userId: emailPreference.userId,
      days: emailPreference.dueReminderDaysBefore,
      name: user.name,
      email: user.email,
    })
    .from(emailPreference)
    .innerJoin(user, eq(user.id, emailPreference.userId))
    .where(eq(emailPreference.dueRemindersEnabled, true));

  const today = todayISO();
  let sent = 0;

  for (const p of prefs) {
    const until = addDays(today, p.days);
    const rows = await db
      .select({
        concept: expense.concept,
        amount: expense.amount,
        currency: expense.currency,
        dueDate: expense.dueDate,
        periodLabel: period.label,
      })
      .from(expense)
      .innerJoin(period, eq(expense.periodId, period.id))
      .where(
        and(
          eq(expense.userId, p.userId),
          isNotNull(expense.dueDate),
          gte(expense.dueDate, today),
          lte(expense.dueDate, until),
          ne(expense.status, 'pagado')
        )
      );

    // Cuotas/gastos de vehículo (préstamo, seguro…), que viven en su propia
    // tabla en vez de `expense`/`period` (ver `app/(dashboard)/auto`).
    const vehicleRows = await db
      .select({
        concept: vehicleExpense.concept,
        amount: vehicleExpense.amount,
        currency: vehicleExpense.currency,
        dueDate: vehicleExpense.dueDate,
        month: vehicleExpense.month,
        year: vehicleExpense.year,
      })
      .from(vehicleExpense)
      .where(
        and(
          eq(vehicleExpense.userId, p.userId),
          isNotNull(vehicleExpense.dueDate),
          gte(vehicleExpense.dueDate, today),
          lte(vehicleExpense.dueDate, until),
          eq(vehicleExpense.paid, false)
        )
      );

    if (rows.length === 0 && vehicleRows.length === 0) continue;

    const items: DueItem[] = [
      ...rows.map((r) => ({
        concept: r.concept,
        amountLabel: formatMoney(r.amount, r.currency),
        dueDateLabel: r.dueDate ? formatDate(r.dueDate) : '',
        periodLabel: r.periodLabel,
      })),
      ...vehicleRows.map((r) => ({
        concept: r.concept,
        amountLabel: formatMoney(r.amount, r.currency),
        dueDateLabel: r.dueDate ? formatDate(r.dueDate) : '',
        periodLabel: periodLabel(r.month, r.year),
      })),
    ];

    await sendEmail({
      to: p.email,
      subject: `Tienes ${items.length} gasto(s) por vencer`,
      react: DueReminderEmail({ name: p.name, items }),
    });
    sent++;
  }

  return { sent };
}

/** Avisos de tareas de Todos próximas a vencer, según las preferencias de cada usuario. */
export async function runTodoDueReminders(): Promise<{ sent: number }> {
  const prefs = await db
    .select({
      userId: emailPreference.userId,
      days: emailPreference.todoDueReminderDaysBefore,
      name: user.name,
      email: user.email,
    })
    .from(emailPreference)
    .innerJoin(user, eq(user.id, emailPreference.userId))
    .where(eq(emailPreference.todoDueRemindersEnabled, true));

  const today = todayISO();
  let sent = 0;

  for (const p of prefs) {
    const until = addDays(today, p.days);
    const rows = await db
      .select({
        title: todo.title,
        dueDate: todo.dueDate,
        year: todo.year,
      })
      .from(todo)
      .where(
        and(
          eq(todo.userId, p.userId),
          isNotNull(todo.dueDate),
          gte(todo.dueDate, today),
          lte(todo.dueDate, until),
          isNull(todo.completedAt)
        )
      );

    if (rows.length === 0) continue;

    const items: TodoDueItem[] = rows.map((r) => ({
      title: r.title,
      dueDateLabel: r.dueDate ? formatDate(r.dueDate) : '',
      year: r.year,
    }));

    await sendEmail({
      to: p.email,
      subject: `Tienes ${items.length} tarea(s) por vencer`,
      react: TodoDueReminderEmail({ name: p.name, items }),
    });
    sent++;
  }

  return { sent };
}

/** Resumen del mes anterior, una vez por mes y por usuario. */
export async function runMonthlySummary(): Promise<{ sent: number }> {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // mes anterior (getMonth es 0-based → mes previo en 1-based)
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  const key = `${year}-${String(month).padStart(2, '0')}`;

  const prefs = await db
    .select({
      userId: emailPreference.userId,
      last: emailPreference.lastSummarySentFor,
      name: user.name,
      email: user.email,
    })
    .from(emailPreference)
    .innerJoin(user, eq(user.id, emailPreference.userId))
    .where(eq(emailPreference.monthlySummaryEnabled, true));

  let sent = 0;

  for (const p of prefs) {
    if (p.last === key) continue;

    const [per] = await db
      .select()
      .from(period)
      .where(
        and(
          eq(period.userId, p.userId),
          eq(period.year, year),
          eq(period.month, month)
        )
      );
    if (!per) continue;

    const exps = await db
      .select({
        amount: expense.amount,
        currency: expense.currency,
        status: expense.status,
        categoryId: expense.categoryId,
      })
      .from(expense)
      .where(eq(expense.periodId, per.id));

    const cats = await db
      .select()
      .from(category)
      .where(eq(category.userId, p.userId));

    const t = periodTotals(exps, per.dollarRate, per.incomeTotal);

    await sendEmail({
      to: p.email,
      subject: `Resumen de ${per.label}`,
      react: MonthlySummaryEmail({
        name: p.name,
        periodLabel: per.label,
        incomeLabel: formatMoney(per.incomeTotal, per.localCurrency),
        totalLabel: `${formatMoney(t.totalLocal, per.localCurrency)} (${formatUSD(t.totalUsd)})`,
        restanteLabel: formatMoney(t.restante, per.localCurrency),
        pctLabel: `${t.pctUsado.toFixed(1)}%`,
        categories: cats
          .filter((c) => (t.byCategory[c.id] ?? 0) > 0)
          .map((c) => ({
            name: c.name,
            amountLabel: formatMoney(t.byCategory[c.id] ?? 0, per.localCurrency),
          })),
      }),
    });

    await db
      .update(emailPreference)
      .set({ lastSummarySentFor: key })
      .where(eq(emailPreference.userId, p.userId));
    sent++;
  }

  return { sent };
}

/** Alerta cuando el mes en curso supera el umbral de presupuesto. */
export async function runBudgetAlerts(): Promise<{ sent: number }> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const prefs = await db
    .select({
      userId: emailPreference.userId,
      threshold: emailPreference.budgetAlertThresholdPct,
      name: user.name,
      email: user.email,
    })
    .from(emailPreference)
    .innerJoin(user, eq(user.id, emailPreference.userId))
    .where(eq(emailPreference.budgetAlertEnabled, true));

  let sent = 0;

  for (const p of prefs) {
    const [per] = await db
      .select()
      .from(period)
      .where(
        and(
          eq(period.userId, p.userId),
          eq(period.year, year),
          eq(period.month, month)
        )
      );
    if (!per || per.incomeTotal <= 0) continue;

    const exps = await db
      .select({
        amount: expense.amount,
        currency: expense.currency,
        status: expense.status,
        categoryId: expense.categoryId,
      })
      .from(expense)
      .where(eq(expense.periodId, per.id));

    const t = periodTotals(exps, per.dollarRate, per.incomeTotal);
    if (t.pctUsado < p.threshold) continue;

    await sendEmail({
      to: p.email,
      subject: `Alerta de presupuesto — ${per.label}`,
      react: BudgetAlertEmail({
        name: p.name,
        periodLabel: per.label,
        pctLabel: `${t.pctUsado.toFixed(1)}%`,
        totalLabel: formatMoney(t.totalLocal, per.localCurrency),
        incomeLabel: formatMoney(per.incomeTotal, per.localCurrency),
        restanteLabel: formatMoney(t.restante, per.localCurrency),
      }),
    });
    sent++;
  }

  return { sent };
}

const SALARY_DEPOSIT_NOTE = 'Depósito de sueldo (automático)';

/**
 * Deposita el sueldo configurado en el apartado elegido, el día que
 * corresponda (según la zona horaria del país de cada usuario), una sola vez
 * por mes. Pensado para un cron diario (no hay forma de elegir una hora
 * exacta en el plan de hosting actual).
 */
export async function runSalaryDeposits(): Promise<{ deposited: number }> {
  const rows = await db
    .select({
      id: salaryDeposit.id,
      userId: salaryDeposit.userId,
      accountId: salaryDeposit.accountId,
      amount: salaryDeposit.amount,
      dayMode: salaryDeposit.dayMode,
      fixedDay: salaryDeposit.fixedDay,
      lastRunYear: salaryDeposit.lastRunYear,
      lastRunMonth: salaryDeposit.lastRunMonth,
      country: userSettings.country,
      accountBalance: savingsAccount.balance,
      accountUserId: savingsAccount.userId,
    })
    .from(salaryDeposit)
    .innerJoin(userSettings, eq(userSettings.userId, salaryDeposit.userId))
    .leftJoin(savingsAccount, eq(savingsAccount.id, salaryDeposit.accountId))
    .where(eq(salaryDeposit.enabled, true));

  let deposited = 0;

  for (const row of rows) {
    // Apartado borrado, o (por las dudas) de otro usuario: nada que depositar.
    if (!row.accountId || row.accountBalance === null || row.accountUserId !== row.userId) {
      continue;
    }
    if (row.amount <= 0) continue;

    const timezone = getCountry(row.country).timezone;
    const { year, month, day } = nowInTimezone(timezone);
    const targetDay = resolveSalaryDepositDay(year, month, row.dayMode, row.fixedDay);
    if (day !== targetDay) continue;
    if (row.lastRunYear === year && row.lastRunMonth === month) continue; // ya corrió este mes

    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    await db.insert(savingsMovement).values({
      userId: row.userId,
      accountId: row.accountId,
      amount: row.amount,
      note: SALARY_DEPOSIT_NOTE,
      date,
    });
    await db
      .update(savingsAccount)
      .set({ balance: row.accountBalance + row.amount })
      .where(eq(savingsAccount.id, row.accountId));
    await db
      .update(salaryDeposit)
      .set({ lastRunYear: year, lastRunMonth: month, lastRunAt: new Date() })
      .where(eq(salaryDeposit.id, row.id));

    deposited++;
  }

  return { deposited };
}
