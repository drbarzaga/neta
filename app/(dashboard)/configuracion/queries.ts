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
import { decryptSecret } from '@/lib/crypto';

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

/**
 * Devuelve la API key del usuario (descifrada) y el modelo configurado, o key
 * null si no tiene. Solo para uso en el servidor; nunca enviar la key al cliente.
 */
export async function getUserAiConfig(
  userId: string
): Promise<{ key: string | null; model: string | null }> {
  const [row] = await db
    .select({ key: userSettings.anthropicApiKey, model: userSettings.aiModel })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return {
    key: row?.key ? decryptSecret(row.key) : null,
    model: row?.model ?? null,
  };
}
