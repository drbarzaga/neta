import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-server';
import { getCountry } from '@/lib/countries';
import { getLatestRate } from '@/lib/exchange-rate';
import { getOrCreateUserSettings } from '../configuracion/queries';
import { getTrips } from './queries';
import { TripsClient } from './_components/trips-client';

export const metadata: Metadata = { title: 'Viajes — Neta' };

export default async function ViajesPage() {
  const { userId } = await requireSession();
  const [trips, settings] = await Promise.all([
    getTrips(userId),
    getOrCreateUserSettings(userId),
  ]);
  const country = getCountry(settings.country);
  const dollarRate = await getLatestRate(settings.country, settings.arCasa);

  return (
    <TripsClient
      trips={trips}
      locale={country.locale}
      localCurrency={country.currency}
      defaultDollarRate={dollarRate}
    />
  );
}
