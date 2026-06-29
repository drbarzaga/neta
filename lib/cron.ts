import 'server-only';

/** Verifica el header Authorization: Bearer <CRON_SECRET>. */
export function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}
