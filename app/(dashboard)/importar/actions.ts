'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, and, category, period, expense } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { getLatestRate } from '@/lib/exchange-rate';
import { getCountry } from '@/lib/countries';
import { periodLabel } from '@/lib/dates';
import { getOrCreateUserSettings } from '../configuracion/queries';
import { importSchema } from './schema';

const PALETTE = ['#86efac', '#93c5fd', '#5eead4', '#bfdbfe', '#fca5a5', '#fcd34d', '#c4b5fd', '#f9a8d4'];

export async function importPeriod(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos en el archivo');
  const { year, month, incomeTotal, dollarRate, rows } = parsed.data;

  const [dup] = await db
    .select({ id: period.id })
    .from(period)
    .where(
      and(
        eq(period.userId, session.userId),
        eq(period.year, year),
        eq(period.month, month)
      )
    );
  if (dup) return fail('Ya existe un mes para ese período');

  // Resolver/crear categorías por nombre (case-insensitive).
  const existing = await db
    .select()
    .from(category)
    .where(eq(category.userId, session.userId));
  const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c.id]));
  let order = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1;

  const distinct = [...new Set(rows.map((r) => r.categoria.trim()))];
  for (const name of distinct) {
    if (byName.has(name.toLowerCase())) continue;
    const [row] = await db
      .insert(category)
      .values({
        userId: session.userId,
        name,
        color: PALETTE[order % PALETTE.length],
        sortOrder: order++,
      })
      .returning({ id: category.id });
    byName.set(name.toLowerCase(), row.id);
  }

  const settings = await getOrCreateUserSettings(session.userId);
  const localCurrency = getCountry(settings.country).currency;
  const rate =
    dollarRate > 0 ? dollarRate : await getLatestRate(settings.country, settings.arCasa);

  const [per] = await db
    .insert(period)
    .values({
      userId: session.userId,
      label: periodLabel(month, year),
      year,
      month,
      incomeTotal,
      localCurrency,
      dollarRate: rate,
    })
    .returning({ id: period.id });

  await db.insert(expense).values(
    rows.map((r, i) => ({
      userId: session.userId,
      periodId: per.id,
      categoryId: byName.get(r.categoria.trim().toLowerCase())!,
      concept: r.concepto,
      amount: r.amount,
      // El parser marca 'UYU' para la columna local; se mapea a la moneda del país.
      currency: r.currency === 'USD' ? 'USD' : localCurrency,
      status: r.status,
      dueDate: r.dueDate,
      sortOrder: i,
    }))
  );

  revalidatePath('/meses');
  revalidatePath('/');
  return ok({ id: per.id });
}
