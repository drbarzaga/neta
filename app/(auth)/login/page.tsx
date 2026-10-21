import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth-server';
import { LoginForm } from './_components/login-form';

export const metadata: Metadata = { title: 'Iniciar sesión — Neta' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  // Chequeo real (no solo la presencia de la cookie, ver `proxy.ts`): si la
  // sesión sigue vigente, nos salteamos el formulario.
  const session = await verifySession();
  if (session) redirect('/');
  return <LoginForm expired={expired === '1'} />;
}
