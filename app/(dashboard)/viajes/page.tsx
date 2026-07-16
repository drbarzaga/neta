import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-server';
import { getCountry } from '@/lib/countries';
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

  return (
    <TripsClient
      trips={trips}
      locale={country.locale}
      localCurrency={country.currency}
    />
  );
}
