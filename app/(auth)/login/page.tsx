import type { Metadata } from 'next';
import { LoginForm } from './_components/login-form';

export const metadata: Metadata = { title: 'Iniciar sesión — Neta' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  return <LoginForm expired={expired === '1'} />;
}
