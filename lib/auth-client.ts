import { createAuthClient } from 'better-auth/react';
import { passkeyClient } from '@better-auth/passkey/client';
import { lastLoginMethodClient } from 'better-auth/client/plugins';

// Sin baseURL: en el navegador usa el mismo origen (window.location.origin),
// así funciona en cualquier puerto (3000, 3001, etc.) sin tocar el .env.
export const authClient = createAuthClient({
  plugins: [passkeyClient(), lastLoginMethodClient()],
});

export const { signIn, signUp, signOut, useSession, passkey } = authClient;
