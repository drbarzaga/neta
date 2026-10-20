import 'server-only';
import { db, uiValue, desc } from '@/db';
import { todayISO } from '@/lib/dates';

// Valor de referencia si no hay nada cacheado y falla el fetch (UI ~oct/2026).
const FALLBACK_UI = 6.67;

export const UI_SOURCE_NAME = 'datosuruguay';

/** Atribución requerida por la licencia CC-BY-4.0 de datosuruguay.com. Mostrar junto al valor en la UI. */
export const UI_ATTRIBUTION = {
  text: 'Datos de datosUruguay.com',
  url: 'https://datosuruguay.com/ui?utm_source=api&utm_medium=attribution&utm_campaign=backlinks',
};

interface IndexedUnitPoint {
  date: string;
  series: string;
  value: number;
}

interface IndexedUnitsResponse {
  data: IndexedUnitPoint[];
}

/**
 * Valor más reciente de la UI desde datosuruguay.com (proxy no oficial, fuente
 * declarada BCU). `null` si falla — el caller decide el fallback (cache o manual).
 */
export async function fetchUiValue(): Promise<{ date: string; value: number } | null> {
  try {
    const res = await fetch('https://datosuruguay.com/api/v1/indexed-units/ui?limit=1', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as IndexedUnitsResponse;
    const point = json?.data?.[0];
    if (!point || typeof point.value !== 'number' || point.value <= 0) return null;
    return { date: point.date.slice(0, 10), value: point.value };
  } catch {
    return null;
  }
}

async function latestRow() {
  const [row] = await db.select().from(uiValue).orderBy(desc(uiValue.date)).limit(1);
  return row;
}

/** Valor cacheado más reciente; si no hay, lo trae; si falla, FALLBACK. */
export async function getLatestUiValue(): Promise<number> {
  const row = await latestRow();
  if (row) return row.value;

  const fetched = await fetchUiValue();
  if (fetched) {
    await db
      .insert(uiValue)
      .values({ date: fetched.date, value: fetched.value, source: UI_SOURCE_NAME })
      .onConflictDoNothing();
    return fetched.value;
  }
  return FALLBACK_UI;
}

export interface UiValueInfo {
  value: number;
  date: string;
  source: string;
}

/** Valor vigente de la UI con metadatos (fecha y fuente), para mostrar en la interfaz. */
export async function getLatestUiValueInfo(): Promise<UiValueInfo> {
  const row = await latestRow();
  if (row) return { value: row.value, date: row.date, source: row.source };
  const value = await getLatestUiValue();
  return { value, date: todayISO(), source: UI_SOURCE_NAME };
}

/** Fija manualmente el valor de una fecha (fallback cuando falla el fetch automático). */
export async function setManualUiValue(value: number, date: string = todayISO()): Promise<number> {
  await db
    .insert(uiValue)
    .values({ date, value, source: 'manual' })
    .onConflictDoUpdate({
      target: [uiValue.date],
      set: { value, source: 'manual' },
    });
  return value;
}

/** Refresca el cache de hoy (lo usa el cron / un botón manual). */
export async function refreshUiValue(): Promise<number> {
  const fetched = await fetchUiValue();
  if (fetched) {
    await db
      .insert(uiValue)
      .values({ date: fetched.date, value: fetched.value, source: UI_SOURCE_NAME })
      .onConflictDoUpdate({
        target: [uiValue.date],
        set: { value: fetched.value, source: UI_SOURCE_NAME },
      });
    return fetched.value;
  }
  return getLatestUiValue();
}
