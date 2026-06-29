import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-4-8';

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

export function isAiConfigured(): boolean {
  return client !== null;
}

export interface AdvisorMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Abre un stream con el asesor financiero. `context` es el resumen de los
 * datos del usuario (ver lib/advisor-context) y `messages` la conversación.
 * Devuelve el stream del SDK; quien lo consume reenvía solo el texto.
 */
export function advisorStream(context: string, messages: AdvisorMessage[]) {
  if (!client) {
    throw new Error('IA no configurada: falta ANTHROPIC_API_KEY.');
  }

  const system = [
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
    'DATOS DEL USUARIO:',
    context,
  ].join('\n');

  return client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
}
