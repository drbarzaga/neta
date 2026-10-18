import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth-server';
import { getCountry } from '@/lib/countries';
import { getOrCreateUserSettings } from '../../configuracion/queries';
import {
  getPeriod,
  getCategories,
  getExpenses,
  getOtherPeriods,
  getAdjacentPeriods,
} from './queries';
import { getTemplatesWithCategory } from '../../plantillas/queries';
import { getGoals } from '../../metas/queries';
import { getSavingsAccounts } from '../../ahorros/queries';
import { listTripsForLinking } from '../../viajes/queries';
import { listVehicleInstallmentsForLinking } from '../../auto/queries';
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

  const [
    categories,
    expenses,
    templates,
    goals,
    settings,
    otherPeriods,
    savingsAccounts,
    trips,
    vehicleInstallments,
    adjacentPeriods,
  ] = await Promise.all([
    getCategories(userId),
    getExpenses(userId, id),
    getTemplatesWithCategory(userId),
    getGoals(userId),
    getOrCreateUserSettings(userId),
    getOtherPeriods(userId, id),
    getSavingsAccounts(userId),
    listTripsForLinking(userId),
    listVehicleInstallmentsForLinking(userId),
    getAdjacentPeriods(userId, period.year, period.month),
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
      trips={trips}
      vehicleInstallments={vehicleInstallments}
      prevPeriod={adjacentPeriods.prev}
      nextPeriod={adjacentPeriods.next}
      locale={locale}
      displayCurrency={settings.displayCurrency === 'usd' ? 'usd' : 'local'}
    />
  );
}
