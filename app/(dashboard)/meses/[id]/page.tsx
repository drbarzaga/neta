import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth-server';
import { getCountry } from '@/lib/countries';
import { getOrCreateUserSettings } from '../../configuracion/queries';
import {
  getPeriod,
  getCategories,
  getExpenses,
  getOtherPeriods,
} from './queries';
import { getTemplatesWithCategory } from '../../plantillas/queries';
import { getGoals } from '../../metas/queries';
import { getSavingsAccounts } from '../../ahorros/queries';
import { MonthDetail } from './_components/month-detail';

export default async function MonthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireSession();

  const period = await getPeriod(userId, id);
  if (!period) notFound();

  const [categories, expenses, templates, goals, settings, otherPeriods, savingsAccounts] =
    await Promise.all([
      getCategories(userId),
      getExpenses(userId, id),
      getTemplatesWithCategory(userId),
      getGoals(userId),
      getOrCreateUserSettings(userId),
      getOtherPeriods(userId, id),
      getSavingsAccounts(userId),
    ]);
  const locale = getCountry(settings.country).locale;

  return (
    <MonthDetail
      period={period}
      categories={categories}
      expenses={expenses}
      templates={templates}
      goals={goals.filter((g) => !g.completed)}
      otherPeriods={otherPeriods}
      savingsAccounts={savingsAccounts}
      locale={locale}
      displayCurrency={settings.displayCurrency === 'usd' ? 'usd' : 'local'}
    />
  );
}
