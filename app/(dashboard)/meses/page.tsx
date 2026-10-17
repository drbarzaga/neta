import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-server';
import { getCountry } from '@/lib/countries';
import { getOrCreateUserSettings } from '../configuracion/queries';
import { getPeriodsWithTotals, getPeriodYears, getAllPeriodLabels } from './queries';
import { PeriodsClient } from './_components/periods-client';

export const metadata: Metadata = { title: 'Meses — Neta' };

export default async function MesesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { userId } = await requireSession();
  const { year: yearParam } = await searchParams;

  const currentYear = new Date().getFullYear();
  const year = yearParam ? Number(yearParam) || currentYear : currentYear;

  const [periods, settings, years, allPeriodLabels] = await Promise.all([
    getPeriodsWithTotals(userId, year),
    getOrCreateUserSettings(userId),
    getPeriodYears(userId, currentYear),
    getAllPeriodLabels(userId),
  ]);
  const locale = getCountry(settings.country).locale;

  const data = periods.map((p) => ({
    id: p.id,
    label: p.label,
    year: p.year,
    month: p.month,
    status: p.status,
    incomeTotal: p.incomeTotal,
    totalLocal: p.totals.totalLocal,
    restante: p.totals.restante,
    pctUsado: p.totals.pctUsado,
    count: p.count,
    localCurrency: p.localCurrency,
    locale,
  }));

  return (
    <PeriodsClient
      periods={data}
      allPeriodLabels={allPeriodLabels}
      years={years}
      year={year}
    />
  );
}
