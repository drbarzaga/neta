import { authorizeCron } from '@/lib/cron';
import { runMonthlySummary } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return new Response('Unauthorized', { status: 401 });
  }
  const result = await runMonthlySummary();
  return Response.json({ ok: true, ...result });
}
