'use server';

import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { refreshRate, setManualRate } from '@/lib/exchange-rate';
import { getOrCreateUserSettings } from './configuracion/queries';

/** Trae la cotización del dólar de hoy para el país del usuario. */
export async function refreshGlobalRate(): Promise<ActionResult<{ rate: number }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;
  const settings = await getOrCreateUserSettings(session.userId);
  const rate = await refreshRate(settings.country, settings.arCasa);
  return ok({ rate });
}

/** Fija manualmente la cotización del dólar de hoy para el país del usuario. */
export async function setGlobalRate(
  value: number
): Promise<ActionResult<{ rate: number }>> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;
  if (!Number.isFinite(value) || value <= 0) return fail('Cotización inválida');
  const settings = await getOrCreateUserSettings(session.userId);
  const rate = await setManualRate(settings.country, value);
  return ok({ rate });
}
