import 'server-only';
import {
  db,
  eq,
  and,
  ne,
  gte,
  lte,
  isNotNull,
  user,
  period,
  expense,
  category,
  emailPreference,
} from '@/db';
import { periodTotals, formatUSD, formatMoney } from '@/lib/money';
import { todayISO } from '@/lib/dates';
import { sendEmail } from '@/lib/email';
import { DueReminderEmail, type DueItem } from '@/emails/due-reminder';
import { MonthlySummaryEmail } from '@/emails/monthly-summary';
import { BudgetAlertEmail } from '@/emails/budget-alert';

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

    if (rows.length === 0) continue;

    const items: DueItem[] = rows.map((r) => ({
      concept: r.concept,
      amountLabel: formatMoney(r.amount, r.currency),
      dueDateLabel: r.dueDate ? formatDate(r.dueDate) : '',
      periodLabel: r.periodLabel,
    }));

    await sendEmail({
      to: p.email,
      subject: `Tienes ${items.length} gasto(s) por vencer`,
      react: DueReminderEmail({ name: p.name, items }),
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
