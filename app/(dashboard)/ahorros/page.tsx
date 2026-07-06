import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-server';
import { getCountry } from '@/lib/countries';
import { getLatestRate } from '@/lib/exchange-rate';
import { getOrCreateUserSettings } from '../configuracion/queries';
import { getSavingsAccounts, getSavingsMovements } from './queries';
import { SavingsClient } from './_components/savings-client';

export const metadata: Metadata = { title: 'Ahorros — Neta' };

export default async function AhorrosPage() {
  const { userId } = await requireSession();
  const [accounts, movements, settings] = await Promise.all([
    getSavingsAccounts(userId),
    getSavingsMovements(userId),
    getOrCreateUserSettings(userId),
  ]);
  const country = getCountry(settings.country);
  const rate = await getLatestRate(settings.country, settings.arCasa);

  return (
    <SavingsClient
      accounts={accounts}
      movements={movements}
      rate={rate}
      locale={country.locale}
      localCurrency={country.currency}
    />
  );
}
