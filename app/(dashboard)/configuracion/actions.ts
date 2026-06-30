'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, sql, emailPreference, userSettings, user } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { COUNTRIES } from '@/lib/countries';
import { encryptSecret } from '@/lib/crypto';
import { validateApiKey } from '@/lib/ai';
import { getOrCreateEmailPreference, getOrCreateUserSettings } from './queries';
import {
  preferenceSchema,
  regionSchema,
  appearanceSchema,
  apiKeySchema,
} from './schema';

/** ¿El correo está libre? (lo usa el campo de email del perfil, estilo Google). */
export async function checkEmailAvailable(
  email: string
): Promise<{ available: boolean }> {
  const session = await verifySession();
  if (!session) return { available: false };
  const e = email.trim().toLowerCase();
  if (!e) return { available: false };

  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${e}`);
  // Disponible si nadie más (otro usuario) ya lo tiene.
  const taken = rows.some((r) => r.id !== session.userId);
  return { available: !taken };
}

export async function updateEmailPreference(
  input: unknown
): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = preferenceSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');

  await getOrCreateEmailPreference(session.userId);
  await db
    .update(emailPreference)
    .set(parsed.data)
    .where(eq(emailPreference.userId, session.userId));

  revalidatePath('/configuracion');
  return ok();
}

export async function updateUserSettings(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = regionSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');
  if (!COUNTRIES[parsed.data.country]) return fail('País no soportado');

  await getOrCreateUserSettings(session.userId);
  await db
    .update(userSettings)
    .set(parsed.data)
    .where(eq(userSettings.userId, session.userId));

  // El header (cotización por país) vive en el layout del dashboard.
  revalidatePath('/', 'layout');
  return ok();
}

/** Guarda (cifrada) o borra la API key de Anthropic del usuario (BYOK). */
export async function updateAnthropicKey(
  input: unknown
): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = apiKeySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }

  const raw = parsed.data.apiKey.trim();

  // Validamos contra el proveedor (Anthropic u OpenRouter) antes de guardar.
  if (raw !== '') {
    const check = await validateApiKey(raw);
    if (!check.ok) return fail(check.error ?? 'La key no es válida');
  }

  const value = raw === '' ? null : encryptSecret(raw);

  await getOrCreateUserSettings(session.userId);
  await db
    .update(userSettings)
    .set({ anthropicApiKey: value })
    .where(eq(userSettings.userId, session.userId));

  revalidatePath('/configuracion');
  return ok();
}

export async function updateAppearance(input: unknown): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) return UNAUTHORIZED;

  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) return fail('Datos inválidos');

  await getOrCreateUserSettings(session.userId);
  await db
    .update(userSettings)
    .set(parsed.data)
    .where(eq(userSettings.userId, session.userId));

  // El provider de animaciones vive en el layout del dashboard.
  revalidatePath('/', 'layout');
  return ok();
}
