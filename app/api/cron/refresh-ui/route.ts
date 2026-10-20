import { authorizeCron } from '@/lib/cron';
import { refreshUiValue } from '@/lib/ui-value';
import { recalculateUiInstallments } from '@/lib/vehicle-ui-loan';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const value = await refreshUiValue();
  await recalculateUiInstallments();

  return Response.json({ ok: true, ui: value });
}
