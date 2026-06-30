import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_MODEL = 'claude-opus-4-8';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o';

/** Key del servidor (fallback, Anthropic). Cada usuario puede usar la suya (BYOK). */
export const serverApiKey = process.env.ANTHROPIC_API_KEY ?? null;

export interface AdvisorMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AiProvider = 'openrouter' | 'anthropic';

/** Proveedor detectado a partir del prefijo de la key. null si no se reconoce. */
export function providerForKey(apiKey: string): AiProvider | null {
  if (apiKey.startsWith('sk-or-')) return 'openrouter';
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  return null;
}

/**
 * Verifica contra el proveedor que la key es válida (y de paso detecta cuál es).
 * Hace una llamada barata a un endpoint de solo lectura, sin gastar tokens.
 */
export async function validateApiKey(
  apiKey: string
): Promise<{ ok: boolean; provider: AiProvider | null; error?: string }> {
  const provider = providerForKey(apiKey);
  if (!provider) {
    return {
      ok: false,
      provider: null,
      error: 'No reconocemos esa key. Usa una de Anthropic o de OpenRouter.',
    };
  }
  try {
    const res =
      provider === 'anthropic'
        ? await fetch('https://api.anthropic.com/v1/models?limit=1', {
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          })
        : await fetch('https://openrouter.ai/api/v1/key', {
            headers: { Authorization: `Bearer ${apiKey}` },
          });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, provider, error: 'La key no es válida o fue revocada.' };
    }
    if (!res.ok) {
      return {
        ok: false,
        provider,
        error: `El proveedor respondió ${res.status}. Intenta de nuevo.`,
      };
    }
    return { ok: true, provider };
  } catch {
    return {
      ok: false,
      provider,
      error: 'No pudimos validar la key (problema de conexión).',
    };
  }
}

function buildSystem(context: string): string {
  return [
    'Eres un asesor financiero personal dentro de "Neta", una app de presupuesto mensual.',
    'Hablas en español neutro, cercano y claro. Tratas al usuario de "tú" y evitas modismos regionales o rioplatenses.',
    '',
    'OBJETIVO',
    'Ayudar a entender los presupuestos y dar ideas concretas y accionables: gastos altos,',
    'categorías que se pasan, oportunidades de ahorro, comparación entre meses y ajustes sugeridos.',
    '',
    'CONTENIDO',
    '- Básate ÚNICAMENTE en los datos de abajo. No inventes cifras ni gastos. Si falta información, dilo y pide lo que necesitas.',
    '- Usa montos reales en la moneda del mes; cuando ayude, agrega el porcentaje sobre el ingreso o sobre el total.',
    '- Prioriza por impacto: primero lo que más mueve la aguja. Máximo 3 o 4 ideas.',
    '- Nada de consejos genéricos: átalos siempre a los números del usuario.',
    '- Las cotizaciones y montos son los que el usuario cargó; no consultas precios externos.',
    '',
    'FORMATO (TEXTO PLANO, SIN MARKDOWN)',
    '- Empieza con una sola frase breve que responda directo a la pregunta.',
    '- Luego organiza en secciones cortas. Cada sección: un título en su propia línea terminado en ":" y debajo las viñetas.',
    '- Viñetas principales con "• " y sub-puntos con tres espacios y "– " (sangría).',
    '- Deja una línea en blanco entre secciones. Usa frases cortas (1 a 2 líneas), sin párrafos largos.',
    '- PROHIBIDO usar sintaxis Markdown: nada de #, *, **, comillas invertidas, tablas ni enlaces.',
    '  Para destacar, escribe normal o en MAYÚSCULAS (por ejemplo el nombre de una categoría).',
    '- Si corresponde, cierra con UNA sola pregunta o siguiente paso, en su propia línea.',
    '- Sé breve y ve al grano.',
    '',
    'SIMULACIONES ("qué pasa si")',
    '- Si el usuario plantea un escenario hipotético (subir/bajar un gasto o categoría, otro ingreso, pagar una meta más rápido), calcúlalo con SUS números reales del mes.',
    '- Muestra el antes → después de lo relevante: gasto total, restante del mes y % del ingreso; si toca una meta, estima cuánto por mes o en qué fecha la alcanzaría.',
    '- Sé explícito y breve con los cálculos y aclara que es una estimación. La simulación NO cambia nada: solo propón una <action> si el usuario decide aplicarla.',
    '',
    'ACCIONES (solo si el usuario pide crear o cambiar algo)',
    '- Además de tu respuesta, podés PROPONER acciones para que el usuario las confirme (tú no ejecutas nada).',
    '- Emite cada acción en su propia línea, con esta etiqueta exacta y JSON válido en una sola línea:',
    '  <action>{"type":"add_expense","category":"NOMBRE EXACTO","concept":"Netflix","amount":499,"currency":"UYU"}</action>',
    '- Tipos disponibles:',
    '  • add_expense {category, concept, amount, currency?} — agrega un gasto al mes más reciente.',
    '  • mark_paid {concept} — marca como pagado un gasto del mes más reciente.',
    '  • create_goal {title, target, currency?, targetDate?} — crea una meta de ahorro.',
    '  • contribute_goal {goal, amount} — registra un abono a una meta existente.',
    '- Usa EXACTAMENTE los nombres de categorías y metas que aparecen en los datos.',
    '- Solo propone acciones que el usuario pidió explícitamente. Si falta un dato, pregúntalo en vez de inventarlo.',
    '- No expliques el JSON ni muestres la etiqueta en tu texto; el sistema la convierte en un botón de confirmar.',
    '',
    'DATOS DEL USUARIO:',
    context,
  ].join('\n');
}

/** Stream del asesor con Claude (Anthropic) directo. */
async function* anthropicStream(
  apiKey: string,
  system: string,
  messages: AdvisorMessage[]
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}

/** Stream del asesor vía OpenRouter (API compatible con OpenAI, SSE por fetch). */
async function* openRouterStream(
  apiKey: string,
  model: string,
  system: string,
  messages: AdvisorMessage[]
): AsyncGenerator<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Neta',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream: true,
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `OpenRouter respondió ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // la última puede estar incompleta
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '' || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) yield delta;
      } catch {
        // línea parcial o keep-alive; se ignora
      }
    }
  }
}

/**
 * Genera la respuesta del asesor como flujo de texto, eligiendo el proveedor
 * según la key (OpenRouter si empieza con "sk-or-", si no Anthropic/Claude).
 * `model` solo aplica a OpenRouter.
 */
export function streamAdvice(args: {
  apiKey: string;
  model?: string | null;
  context: string;
  messages: AdvisorMessage[];
}): AsyncGenerator<string> {
  const system = buildSystem(args.context);
  if (providerForKey(args.apiKey) === 'openrouter') {
    return openRouterStream(
      args.apiKey,
      args.model?.trim() || DEFAULT_OPENROUTER_MODEL,
      system,
      args.messages
    );
  }
  return anthropicStream(args.apiKey, system, args.messages);
}
