import 'server-only';
import { db, exchangeRate, eq, desc } from '@/db';
import { todayISO } from '@/lib/dates';
import { getCountry, DEFAULT_COUNTRY, DEFAULT_AR_CASA } from '@/lib/countries';

const FALLBACK_RATE = 40;

export const RATE_SOURCE_NAME = 'dolarapi.com';

interface DolarApiItem {
  moneda?: string;
  casa?: string;
  compra?: number;
  venta?: number;
}

/**
 * Cotización USD -> moneda local de un país desde dolarapi. `null` si falla.
 * Argentina usa `/v1/dolares` (elige la casa); el resto `/v1/cotizaciones` (item USD).
 */
export async function fetchUsdRate(
  countryCode: string,
  casa: string = DEFAULT_AR_CASA
): Promise<number | null> {
  const country = getCountry(countryCode);
  const url = country.isArgentina
    ? `https://${country.host}/v1/dolares`
    : `https://${country.host}/v1/cotizaciones`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as DolarApiItem[];
    if (!Array.isArray(json)) return null;
    const item = country.isArgentina
      ? json.find((i) => i.casa === casa)
      : json.find((i) => i.moneda === 'USD');
    if (!item) return null;
    const rate = Number(item.venta) || Number(item.compra) || 0;
    return rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

async function latestRow(countryCode: string) {
  const [row] = await db
    .select()
    .from(exchangeRate)
    .where(eq(exchangeRate.country, countryCode))
    .orderBy(desc(exchangeRate.date))
    .limit(1);
  return row;
}

/** Cotización más reciente cacheada del país; si no hay, la trae; si falla, FALLBACK. */
export async function getLatestRate(
  countryCode: string = DEFAULT_COUNTRY,
  casa?: string
): Promise<number> {
  const row = await latestRow(countryCode);
  if (row) return row.usdRate;

  const fetched = await fetchUsdRate(countryCode, casa);
  if (fetched) {
    await db
      .insert(exchangeRate)
      .values({ date: todayISO(), country: countryCode, usdRate: fetched })
      .onConflictDoNothing();
    return fetched;
  }
  return FALLBACK_RATE;
}

export interface RateInfo {
  rate: number;
  date: string;
  source: string;
}

/** Cotización vigente del país con metadatos (fecha y fuente), para la UI. */
export async function getLatestRateInfo(
  countryCode: string = DEFAULT_COUNTRY
): Promise<RateInfo> {
  const row = await latestRow(countryCode);
  if (row) return { rate: row.usdRate, date: row.date, source: row.source };
  const rate = await getLatestRate(countryCode);
  return { rate, date: todayISO(), source: 'dolarapi' };
}

/** Fija manualmente la cotización de hoy para el país. */
export async function setManualRate(
  countryCode: string,
  rate: number
): Promise<number> {
  await db
    .insert(exchangeRate)
    .values({ date: todayISO(), country: countryCode, usdRate: rate, source: 'manual' })
    .onConflictDoUpdate({
      target: [exchangeRate.date, exchangeRate.country],
      set: { usdRate: rate, source: 'manual' },
    });
  return rate;
}

/** Refresca el cache de hoy para el país (lo usa el cron / botón). */
export async function refreshRate(
  countryCode: string = DEFAULT_COUNTRY,
  casa?: string
): Promise<number> {
  const fetched = await fetchUsdRate(countryCode, casa);
  if (fetched) {
    await db
      .insert(exchangeRate)
      .values({ date: todayISO(), country: countryCode, usdRate: fetched, source: 'dolarapi' })
      .onConflictDoUpdate({
        target: [exchangeRate.date, exchangeRate.country],
        set: { usdRate: fetched },
      });
    return fetched;
  }
  return getLatestRate(countryCode, casa);
}
