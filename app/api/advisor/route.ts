import { verifySession } from '@/lib/auth-server';
import { isAiConfigured, advisorStream, type AdvisorMessage } from '@/lib/ai';
import { buildFinancialContext } from '@/lib/advisor-context';

export const runtime = 'nodejs';
export const maxDuration = 60;

function isValidMessages(value: unknown): value is AdvisorMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (m): m is AdvisorMessage =>
        !!m &&
        typeof m === 'object' &&
        (m as AdvisorMessage).role !== undefined &&
        ((m as AdvisorMessage).role === 'user' ||
          (m as AdvisorMessage).role === 'assistant') &&
        typeof (m as AdvisorMessage).content === 'string'
    )
  );
}

export async function POST(req: Request) {
  const session = await verifySession();
  if (!session) {
    return new Response('No autorizado', { status: 401 });
  }
  if (!isAiConfigured()) {
    return new Response('La IA no está configurada en el servidor.', {
      status: 503,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Cuerpo inválido', { status: 400 });
  }

  const messages = (body as { messages?: unknown })?.messages;
  if (!isValidMessages(messages)) {
    return new Response('Mensajes inválidos', { status: 400 });
  }
  // Recortamos a las últimas vueltas para acotar el contexto.
  const trimmed = messages.slice(-20);

  const { context } = await buildFinancialContext(session.userId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const ai = advisorStream(context, trimmed);
        for await (const event of ai) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Error al generar la respuesta';
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
