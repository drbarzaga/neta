import 'server-only';
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
} from 'crypto';

// Cifrado simétrico para secretos guardados en la BD (p. ej. la API key del
// usuario). AES-256-GCM. La clave se deriva de BETTER_AUTH_SECRET, así no hace
// falta una variable de entorno extra. Si rotas ese secreto, los valores
// cifrados anteriores dejan de poder descifrarse (hay que volver a guardarlos).

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recomendado para GCM
const TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('Falta BETTER_AUTH_SECRET para cifrar secretos.');
  }
  cachedKey = scryptSync(secret, 'neta-secret-encryption-v1', 32);
  return cachedKey;
}

/** Cifra un texto y devuelve un token base64 (iv + tag + ciphertext). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/** Descifra un token producido por encryptSecret. Devuelve null si es inválido. */
export function decryptSecret(token: string): string | null {
  try {
    const data = Buffer.from(token, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}
