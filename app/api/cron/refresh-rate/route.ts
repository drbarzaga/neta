import { authorizeCron } from '@/lib/cron';
import { refreshRate } from '@/lib/exchange-rate';
import { db, userSettings } from '@/db';
import { DEFAULT_COUNTRY } from '@/lib/countries';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Refresca la cotización de cada país en uso (distinct country + casa).
  const rows = await db
    .selectDistinct({ country: userSettings.country, arCasa: userSettings.arCasa })
    .from(userSettings);

  const targets =
    rows.length > 0 ? rows : [{ country: DEFAULT_COUNTRY, arCasa: 'blue' }];

  const results: Record<string, number> = {};
  for (const { country, arCasa } of targets) {
    results[country] = await refreshRate(country, arCasa);
  }

  return Response.json({ ok: true, rates: results });
}
