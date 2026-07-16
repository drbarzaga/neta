import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth-server';
import { getCountry } from '@/lib/countries';
import { getOrCreateUserSettings } from '../../configuracion/queries';
import { getTrip, getTripExpenses } from '../queries';
import { TripDetail } from './_components/trip-detail';

export const metadata: Metadata = { title: 'Viaje — Neta' };

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireSession();

  const trip = await getTrip(userId, id);
  if (!trip) notFound();

  const [expenses, settings] = await Promise.all([
    getTripExpenses(userId, id),
    getOrCreateUserSettings(userId),
  ]);
  const country = getCountry(settings.country);

  return (
    <TripDetail
      trip={trip}
      expenses={expenses}
      locale={country.locale}
      localCurrency={country.currency}
    />
  );
}
