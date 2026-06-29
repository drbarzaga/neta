'use server';

import { revalidatePath } from 'next/cache';
import { db, eq, emailPreference, userSettings } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { UNAUTHORIZED, ok, fail, type ActionResult } from '@/lib/action-result';
import { COUNTRIES } from '@/lib/countries';
import { getOrCreateEmailPreference, getOrCreateUserSettings } from './queries';
import { preferenceSchema, regionSchema, appearanceSchema } from './schema';

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
