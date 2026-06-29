import 'server-only';
import { cache } from 'react';
import {
  db,
  eq,
  emailPreference,
  userSettings,
  type EmailPreference,
  type UserSettings,
} from '@/db';

/** Devuelve las preferencias del usuario, creándolas con valores por defecto si faltan. */
export const getOrCreateEmailPreference = cache(async function (
  userId: string
): Promise<EmailPreference> {
  const [existing] = await db
    .select()
    .from(emailPreference)
    .where(eq(emailPreference.userId, userId));
  if (existing) return existing;

  const [created] = await db
    .insert(emailPreference)
    .values({ userId })
    .returning();
  return created;
});

/**
 * Devuelve los ajustes de región/moneda del usuario, creándolos por defecto si faltan.
 * Memorizado por request (React cache) para que el layout y la página no repitan la
 * consulta a Neon en cada navegación.
 */
export const getOrCreateUserSettings = cache(async function (
  userId: string
): Promise<UserSettings> {
  const [existing] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  if (existing) return existing;

  const [created] = await db
    .insert(userSettings)
    .values({ userId })
    .returning();
  return created;
});
