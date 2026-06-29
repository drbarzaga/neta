/**
 * Catálogo de países soportados (basado en dolarapi.com).
 * Cada país define su moneda local y de dónde traer la cotización del dólar.
 * Módulo puro (sin `server-only`): se usa tanto en server como en client.
 */

export interface Country {
  code: string; // ISO-3166 alpha-2, en mayúsculas (clave del catálogo)
  name: string;
  flag: string; // emoji
  currency: string; // ISO-4217 de la moneda local (UYU, ARS, CLP…)
  locale: string; // para Intl.NumberFormat
  /** Host de dolarapi para este país. Argentina usa el dominio raíz. */
  host: string;
  /** Argentina expone varias "casas" de dólar; el resto, una sola cotización. */
  isArgentina?: boolean;
}

export const COUNTRIES: Record<string, Country> = {
  UY: { code: 'UY', name: 'Uruguay', flag: '🇺🇾', currency: 'UYU', locale: 'es-UY', host: 'uy.dolarapi.com' },
  AR: { code: 'AR', name: 'Argentina', flag: '🇦🇷', currency: 'ARS', locale: 'es-AR', host: 'dolarapi.com', isArgentina: true },
  CL: { code: 'CL', name: 'Chile', flag: '🇨🇱', currency: 'CLP', locale: 'es-CL', host: 'cl.dolarapi.com' },
  BR: { code: 'BR', name: 'Brasil', flag: '🇧🇷', currency: 'BRL', locale: 'pt-BR', host: 'br.dolarapi.com' },
  MX: { code: 'MX', name: 'México', flag: '🇲🇽', currency: 'MXN', locale: 'es-MX', host: 'mx.dolarapi.com' },
  BO: { code: 'BO', name: 'Bolivia', flag: '🇧🇴', currency: 'BOB', locale: 'es-BO', host: 'bo.dolarapi.com' },
  CO: { code: 'CO', name: 'Colombia', flag: '🇨🇴', currency: 'COP', locale: 'es-CO', host: 'co.dolarapi.com' },
  VE: { code: 'VE', name: 'Venezuela', flag: '🇻🇪', currency: 'VES', locale: 'es-VE', host: 've.dolarapi.com' },
};

export const DEFAULT_COUNTRY = 'UY';

/** Casas de dólar disponibles en Argentina (dolarapi.com/v1/dolares). */
export const AR_CASAS = [
  { value: 'oficial', label: 'Oficial' },
  { value: 'blue', label: 'Blue' },
  { value: 'bolsa', label: 'Bolsa (MEP)' },
  { value: 'contadoconliqui', label: 'Contado con liqui (CCL)' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'mayorista', label: 'Mayorista' },
  { value: 'cripto', label: 'Cripto' },
] as const;

export const DEFAULT_AR_CASA = 'blue';

export function getCountry(code: string | null | undefined): Country {
  return COUNTRIES[code ?? ''] ?? COUNTRIES[DEFAULT_COUNTRY];
}

export function listCountries(): Country[] {
  return Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** Monedas con 0 decimales en la práctica (montos "grandes"). El resto usa 2. */
const ZERO_DECIMAL = new Set(['UYU', 'ARS', 'CLP', 'COP', 'PYG', 'VES']);

export function currencyDecimals(code: string): number {
  return ZERO_DECIMAL.has(code) ? 0 : 2;
}
