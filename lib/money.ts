import { currencyDecimals } from '@/lib/countries';

const DEFAULT_LOCALE = 'es-UY';

interface MoneyLike {
  amount: number;
  currency: string; // código ISO (moneda local o 'USD')
}

/** Convierte un importe a moneda local usando la cotización del mes (USD -> local). */
export function toLocal(item: MoneyLike, rate: number): number {
  return item.currency === 'USD' ? item.amount * rate : item.amount;
}

/** Convierte un importe a dólares usando la cotización del mes. */
export function toUsd(item: MoneyLike, rate: number): number {
  if (item.currency === 'USD') return item.amount;
  return rate > 0 ? item.amount / rate : 0;
}

export interface PeriodTotals {
  totalLocal: number;
  totalUsd: number;
  restante: number; // en moneda local
  pctUsado: number;
  pagadoLocal: number;
  pendienteLocal: number;
  byCategory: Record<string, number>; // en moneda local
}

interface ExpenseLike extends MoneyLike {
  categoryId: string;
  status: 'pendiente' | 'pagado' | 'vencido';
}

/** Totales de un mes a partir de sus gastos, la cotización y el ingreso (en local). */
export function periodTotals(
  expenses: ExpenseLike[],
  rate: number,
  incomeTotal: number
): PeriodTotals {
  let totalLocal = 0;
  let pagadoLocal = 0;
  const byCategory: Record<string, number> = {};

  for (const e of expenses) {
    const local = toLocal(e, rate);
    totalLocal += local;
    if (e.status === 'pagado') pagadoLocal += local;
    byCategory[e.categoryId] = (byCategory[e.categoryId] ?? 0) + local;
  }

  return {
    totalLocal,
    totalUsd: rate > 0 ? totalLocal / rate : 0,
    restante: incomeTotal - totalLocal,
    pctUsado: incomeTotal > 0 ? (totalLocal / incomeTotal) * 100 : 0,
    pagadoLocal,
    pendienteLocal: totalLocal - pagadoLocal,
    byCategory,
  };
}

export interface TripTotals {
  budgetLocal: number;
  plannedLocal: number; // gastos no pagados aún (estimados)
  paidLocal: number; // gastos ya pagados
  totalLocal: number; // planned + paid
  remainingLocal: number; // budget - totalLocal (solo tiene sentido si budget > 0)
  byCategory: Record<string, number>; // en moneda del viaje
}

interface TripExpenseLike extends MoneyLike {
  category: string;
  paid: boolean;
}

/** Cotización (moneda -> USD) de la moneda del país de destino de un viaje. */
export interface DestinationRate {
  currency: string;
  rate: number;
}

/**
 * Convierte un importe entre las (hasta) tres monedas de un viaje: la del
 * viaje (vía `rate`, unidades por 1 USD), USD, y la del país de destino si
 * se pasa `dest` (vía `dest.rate`, unidades por 1 USD). Usa USD como puente.
 * `rate`/`dest.rate` solo importan cuando esa moneda no es literalmente USD
 * (si el viaje o el destino están denominados en USD, esa conversión es 1:1
 * sin importar lo que haya guardado en el campo de cotización). Una moneda
 * que no matchea ninguna de las tres se devuelve sin convertir.
 */
export function convertTripAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  tripCurrency: string,
  rate: number,
  dest?: DestinationRate | null
): number {
  if (fromCurrency === toCurrency) return amount;

  const rateOf = (currency: string): number | null => {
    if (currency === 'USD') return 1;
    if (currency === tripCurrency) return rate;
    if (dest && currency === dest.currency) return dest.rate;
    return null;
  };

  const fromRate = rateOf(fromCurrency);
  const toRate = rateOf(toCurrency);
  if (fromRate === null || toRate === null || fromRate <= 0 || toRate <= 0) return amount;

  const usd = amount / fromRate;
  return usd * toRate;
}

/** Convierte un gasto de viaje a la moneda del viaje (ver `convertTripAmount`). */
export function tripExpenseToTripCurrency(
  e: TripExpenseLike,
  tripCurrency: string,
  rate: number,
  dest?: DestinationRate | null
): number {
  return convertTripAmount(e.amount, e.currency, tripCurrency, tripCurrency, rate, dest);
}

/** Totales de un viaje a partir de sus gastos, su cotización y su presupuesto. */
export function tripTotals(
  expenses: TripExpenseLike[],
  tripCurrency: string,
  rate: number,
  budget: number,
  dest?: DestinationRate | null
): TripTotals {
  let plannedLocal = 0;
  let paidLocal = 0;
  const byCategory: Record<string, number> = {};

  for (const e of expenses) {
    const local = tripExpenseToTripCurrency(e, tripCurrency, rate, dest);
    if (e.paid) paidLocal += local;
    else plannedLocal += local;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + local;
  }

  const totalLocal = plannedLocal + paidLocal;
  return {
    budgetLocal: budget,
    plannedLocal,
    paidLocal,
    totalLocal,
    remainingLocal: budget - totalLocal,
    byCategory,
  };
}

const fmtCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, locale: string): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currencyDecimals(currency),
    });
    fmtCache.set(key, f);
  }
  return f;
}

/** Formatea un importe en cualquier moneda (ISO) con el locale dado. */
export function formatMoney(
  amount: number,
  currency: string,
  locale: string = DEFAULT_LOCALE
): string {
  return getFormatter(currency, locale).format(amount);
}

export function formatUSD(n: number, locale: string = DEFAULT_LOCALE): string {
  return formatMoney(n, 'USD', locale);
}
