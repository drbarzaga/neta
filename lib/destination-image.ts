import 'server-only';

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

interface WikipediaPage {
  thumbnail?: { source?: string };
}

interface WikipediaSearchResponse {
  query?: { pages?: Record<string, WikipediaPage> };
}

/**
 * Busca una imagen pública representativa de un destino (ciudad/país) vía la
 * API de Wikipedia (sin key, gratuita). Best-effort: null si no encuentra
 * nada o la consulta falla/tarda demasiado.
 */
export async function resolveDestinationImage(
  destination: string
): Promise<string | null> {
  const query = destination.trim();
  if (!query) return null;

  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '1',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '300',
    format: 'json',
    origin: '*',
  });
  const url = `${WIKIPEDIA_API}?${params.toString()}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = (await res.json()) as WikipediaSearchResponse;
    const pages = json.query?.pages ?? {};
    const first = Object.values(pages)[0];
    return first?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}
