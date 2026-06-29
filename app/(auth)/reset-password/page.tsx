import type { Metadata } from 'next';
import { ResetPasswordForm } from './_components/reset-password-form';

export const metadata: Metadata = { title: 'Restablecer contraseña — Neta' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  return <ResetPasswordForm token={token} invalid={error === 'INVALID_TOKEN'} />;
}
