import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { lastLoginMethod } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { sendEmail } from '@/lib/email';
import { ResetPasswordEmail } from '@/emails/reset-password';

// Identificador de la "relying party" (WebAuthn). En dev es `localhost`;
// en prod se deriva del dominio de BETTER_AUTH_URL. El `origin` lo resuelve
// el plugin desde el header de la request, así funciona en cualquier puerto.
const rpID = process.env.BETTER_AUTH_URL
  ? new URL(process.env.BETTER_AUTH_URL).hostname
  : 'localhost';

export const auth = betterAuth({
  // En dev el servidor puede correr en 3000 o 3001; confiamos en ambos
  // para que no falle la verificación de origen.
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Restablece tu contraseña — Neta',
        react: ResetPasswordEmail({ url, name: user.name }),
      });
    },
  },
  user: {
    // Permite que el usuario cambie su correo desde Configuración. Como no
    // verificamos el correo, el cambio se aplica directo.
    changeEmail: { enabled: true },
  },
  plugins: [
    passkey({ rpID, rpName: 'Neta' }),
    lastLoginMethod(),
    // nextCookies debe ir último para que escriba las cookies de las acciones.
    nextCookies(),
  ],
});
