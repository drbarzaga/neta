import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-server';
import { getCountry } from '@/lib/countries';
import { getLatestRate } from '@/lib/exchange-rate';
import { getOrCreateUserSettings } from '../configuracion/queries';
import { getVehicles } from './queries';
import { AutoClient } from './_components/auto-client';

export const metadata: Metadata = { title: 'Auto — Neta' };

export default async function AutoPage() {
  const { userId } = await requireSession();
  const settings = await getOrCreateUserSettings(userId);
  const country = getCountry(settings.country);
  const [vehicles, defaultDollarRate] = await Promise.all([
    getVehicles(userId, country.currency),
    getLatestRate(settings.country, settings.arCasa),
  ]);

  return (
    <AutoClient
      vehicles={vehicles}
      locale={country.locale}
      localCurrency={country.currency}
      defaultDollarRate={defaultDollarRate}
    />
  );
}
