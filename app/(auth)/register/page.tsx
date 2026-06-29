import type { Metadata } from 'next';
import { RegisterForm } from './_components/register-form';

export const metadata: Metadata = { title: 'Crear cuenta — Neta' };

export default function RegisterPage() {
  return <RegisterForm />;
}
