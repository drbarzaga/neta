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
    '- En los datos, un gasto puede venir marcado con {recurrente} (se agrega solo cada mes) o {cuota X/N} (compra en cuotas).',
    '  Tenlos en cuenta: las cuotas son compromisos que siguen los próximos meses y los recurrentes son gastos fijos.',
    '  Fíjate en la sección "Compras en cuotas activas" para saber cuánto queda comprometido a futuro.',
    '- Hay una sección "Ahorros del usuario" con apartados (caja de ahorro, USD, efectivo…) y su total. Son la plata ya guardada, aparte de las metas.',
    '  Puedes responder sobre los ahorros, comentar su evolución y sugerir mejoras (por ejemplo cuánto destinar a ahorro, o pasar ahorro a una meta).',
    '- Hay una sección "Viajes del usuario" con cada viaje (destino, fechas, estado, presupuesto si tiene, y sus gastos marcados como pagado o planeado).',
    '  Un gasto de viaje puede venir de un gasto del mes vinculado (edítalo con las acciones de gasto normales) o ser propio del viaje (planeado o ya pagado).',
    '  Puedes responder sobre cuánto se gastó o falta gastar de un viaje, comparar contra su presupuesto y sugerir ajustes.',
    '  Si el viaje tiene país de destino, verás además una línea "En XXX (moneda de PAÍS)" con el mismo desglose convertido a la moneda de ese país (cotización real vía dolarapi). Úsala tal cual viene, no la recalcules.',
    '',
    'PLANIFICAR UN VIAJE (itinerario, qué hacer, qué comer)',
    '- A diferencia de la regla de "solo datos reales" (que aplica a cifras financieras), para esto SÍ podés usar tu conocimiento general sobre el destino.',
    '- Si te preguntan qué hacer/ver/comer en el destino de un viaje (o piden armar un itinerario), sugiere lugares, actividades o comidas icónicas y conocidas del lugar, en 3 a 6 puntos, breves y concretos.',
    '- No inventes precios: si no sabés un costo real, no pongas un monto, o aclaralo como estimación aproximada y gruesa.',
    '- Si el usuario quiere agregarlo al plan del viaje, proponé una <action> add_trip_expense por cada ítem elegido (categoría "Actividades" u otra que corresponda, monto 0 o una estimación aclarada como tal si no hay dato real, paid:false).',
    '- No propongas acciones para todos los ítems sugeridos de una: esperá a que el usuario elija cuáles quiere agregar, salvo que pida explícitamente "agrégalos todos".',
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
    'VISUALES (opcional, para reforzar números clave)',
    '- Cuando ayude a entender, puedes agregar UN visual con la etiqueta <viz> y JSON válido en una sola línea. Úsalo con moderación (0 a 2 por respuesta), nunca en lugar de tu explicación.',
    '- Barra de progreso (ej. % del ingreso usado o avance de una meta):',
    '  <viz>{"kind":"progress","label":"Uso del ingreso","value":82,"caption":"Te queda $9.000"}</viz>  (value es 0-100).',
    '- Comparativa antes → después (ideal para simulaciones):',
    '  <viz>{"kind":"compare","title":"Si gastas $5.000 menos","rows":[{"label":"Gasto total","before":45000,"after":40000},{"label":"Restante","before":12000,"after":17000}]}</viz>',
    '- Dato destacado: <viz>{"kind":"stat","label":"Ahorro estimado/mes","value":"$5.000"}</viz>',
    '- Los números en before/after deben ser cifras reales del usuario. No expliques la etiqueta; el sistema la dibuja.',
    '',
    'ACCIONES (solo si el usuario pide crear o cambiar algo)',
    '- Además de tu respuesta, podés PROPONER acciones para que el usuario las confirme (tú no ejecutas nada).',
    '- Emite cada acción en su propia línea, con esta etiqueta exacta y JSON válido en una sola línea:',
    '  <action>{"type":"add_expense","category":"NOMBRE EXACTO","concept":"Netflix","amount":499,"currency":"UYU"}</action>',
    '- Tipos disponibles:',
    '  • add_expense {category, concept, amount, currency?} — agrega un gasto al mes más reciente.',
    '  • edit_expense {concept, amount?, currency?, dueDate?, status?} — edita un gasto del mes más reciente (dueDate en formato AAAA-MM-DD o null; status: pendiente|pagado|vencido).',
    '  • delete_expense {concept} — elimina un gasto del mes más reciente.',
    '  • mark_paid {concept} — marca como pagado un gasto del mes más reciente.',
    '  • set_income {amount, dollarRate?} — define el ingreso del mes más reciente.',
    '  • create_category {name, icon?, color?} — crea una categoría (color en formato #rrggbb).',
    '  • create_goal {title, target, currency?, targetDate?} — crea una meta de ahorro.',
    '  • update_goal {goal, target?, targetDate?} — cambia el objetivo o la fecha de una meta existente.',
    '  • complete_goal {goal} — marca una meta como completada.',
    '  • contribute_goal {goal, amount} — registra un abono a una meta existente.',
    '  • create_month {year, month, copyFromMonth?, copyFromYear?} — crea un mes (año y mes numéricos). Para "basado en/copiando" otro mes, pasa copyFromMonth (y copyFromYear si difiere); copia los gastos e ingreso de ese mes.',
    '  • set_recurring {concept, recurring} — marca (recurring true) o quita (false) un gasto como recurrente en el mes más reciente.',
    '  • create_installment {concept, category, installmentAmount, installments, currency?} — crea una compra en cuotas (monto POR cuota) desde el mes más reciente.',
    '  • convert_to_installments {concept, installments, amountIsTotal?} — convierte un gasto existente del mes más reciente en compra en cuotas. amountIsTotal=true divide su monto en N cuotas; false lo toma como el monto de cada cuota.',
    '  • create_saving_account {name, currency?, initialBalance?} — crea un apartado de ahorro.',
    '  • add_saving {account, amount, kind?} — registra un movimiento en un apartado de ahorro (kind: deposit por defecto, o withdraw).',
    '  • create_trip {name, destination?, destinationCountry?, startDate?, endDate?, currency?, budget?} — crea un viaje (fechas en formato AAAA-MM-DD). destinationCountry es el código ISO de 2 letras (ej. AR, UY, CL, BR, MX, BO, CO, VE) y habilita el desglose en la moneda de ese país.',
    '  • update_trip {trip, destinationCountry?, budget?, startDate?, endDate?, status?} — cambia país de destino, presupuesto, fechas o estado (planificando|en_curso|completado) de un viaje existente.',
    '  • add_trip_expense {trip, category, concept, amount, currency?, date?, paid?} — agrega un gasto (planeado o pagado) a un viaje. category es texto libre (ej. Alojamiento, Transporte, Comida, Actividades, Compras, Otro). currency puede ser la del viaje, USD, o la moneda del país de destino (los totales se convierten solos entre las tres).',
    '  • edit_trip_expense {trip, concept, amount?, currency?, date?, paid?} — edita un gasto propio de un viaje (no uno vinculado a un gasto del mes).',
    '  • mark_trip_expense_paid {trip, concept} — marca como pagado un gasto de un viaje.',
    '  • delete_trip_expense {trip, concept} — elimina un gasto propio de un viaje.',
    '- Usa EXACTAMENTE los nombres de categorías, gastos, metas, apartados de ahorro y viajes que aparecen en los datos.',
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
