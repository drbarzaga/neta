import type { Metadata } from 'next';
import { LoginForm } from './_components/login-form';

export const metadata: Metadata = { title: 'Iniciar sesión — Neta' };

export default function LoginPage() {
  return <LoginForm />;
}
