import { getLatestRateInfo } from '@/lib/exchange-rate';
import { getCountry } from '@/lib/countries';
import { getOrCreateUserSettings } from '../configuracion/queries';
import { DollarRate } from './dollar-rate';

/**
 * Carga la cotización del país del usuario. Se renderiza dentro de un <Suspense>
 * en el layout para no bloquear la navegación con consultas a Neon.
 */
export async function HeaderRate({ userId }: { userId: string }) {
  const settings = await getOrCreateUserSettings(userId);
  const country = getCountry(settings.country);
  const { rate } = await getLatestRateInfo(settings.country);

  return (
    <DollarRate
      key={settings.country}
      initialRate={rate}
      localCurrency={country.currency}
      locale={country.locale}
    />
  );
}

/** Placeholder mientras carga la cotización. */
export function HeaderRateFallback() {
  return (
    <div className="bg-muted/60 h-8 w-24 animate-pulse rounded-md" aria-hidden />
  );
}
