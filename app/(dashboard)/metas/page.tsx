import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-server';
import { getCountry } from '@/lib/countries';
import { getOrCreateUserSettings } from '../configuracion/queries';
import { getGoals } from './queries';
import { GoalsClient } from './_components/goals-client';

export const metadata: Metadata = { title: 'Metas — Neta' };

export default async function MetasPage() {
  const { userId } = await requireSession();
  const [goals, settings] = await Promise.all([
    getGoals(userId),
    getOrCreateUserSettings(userId),
  ]);
  const country = getCountry(settings.country);

  return (
    <GoalsClient
      goals={goals}
      locale={country.locale}
      localCurrency={country.currency}
    />
  );
}
