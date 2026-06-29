import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface VerifiedSession {
  userId: string;
  user: SessionUser;
  headers: Headers;
}

/**
 * Verifica la sesión en Server Components y Server Actions usando
 * `auth.api.getSession` como fuente de verdad. Memorizado por request.
 */
export const verifySession = cache(async (): Promise<VerifiedSession | null> => {
  const headersList = await headers();
  const sessionResponse = await auth.api.getSession({ headers: headersList });

  const session = sessionResponse?.session ?? null;
  const user = sessionResponse?.user ?? null;
  if (!session?.userId || !user) {
    return null;
  }

  return {
    userId: session.userId,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    },
    headers: headersList,
  };
});

/** Igual que verifySession() pero redirige a /login cuando no hay sesión. */
export async function requireSession(): Promise<VerifiedSession> {
  const session = await verifySession();
  if (!session) {
    redirect('/login');
  }
  return session;
}
