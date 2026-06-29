import 'server-only';
import { Resend } from 'resend';
import type { ReactElement } from 'react';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? 'Neta <onboarding@resend.dev>';

const resend = apiKey ? new Resend(apiKey) : null;

export interface SendEmailArgs {
  to: string;
  subject: string;
  react: ReactElement;
}

/**
 * Envía un correo con Resend. Si no hay RESEND_API_KEY configurada, lo omite
 * (útil en desarrollo) en lugar de fallar.
 */
export async function sendEmail({ to, subject, react }: SendEmailArgs) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY no configurado; se omite "${subject}" -> ${to}`);
    return { skipped: true as const };
  }
  const { data, error } = await resend.emails.send({ from, to, subject, react });
  if (error) {
    throw new Error(`Resend: ${error.message}`);
  }
  return { id: data?.id };
}
