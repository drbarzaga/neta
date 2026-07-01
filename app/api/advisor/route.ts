import { db, advisorMessage } from '@/db';
import { verifySession } from '@/lib/auth-server';
import { streamAdvice, serverApiKey, type AdvisorMessage } from '@/lib/ai';
import { buildFinancialContext } from '@/lib/advisor-context';
import { getUserAiConfig } from '@/app/(dashboard)/configuracion/queries';

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

  // BYOK: primero la key del usuario; si no tiene, la del servidor (si existe).
  const userAi = await getUserAiConfig(session.userId);
  const apiKey = userAi.key ?? serverApiKey;
  if (!apiKey) {
    return new Response(
      'Configura tu API key (Anthropic u OpenRouter) en Configuración para usar el asesor.',
      { status: 503 }
    );
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
  // El último mensaje es el que el usuario acaba de enviar (para persistirlo).
  const lastUser = trimmed[trimmed.length - 1];

  const { context } = await buildFinancialContext(session.userId);

  const encoder = new TextEncoder();
  const userId = session.userId;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = '';
      try {
        const ai = streamAdvice({
          apiKey,
          model: userAi.model,
          context,
          messages: trimmed,
        });
        for await (const chunk of ai) {
          answer += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Error al generar la respuesta';
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
      } finally {
        controller.close();
        // Persistimos el turno (pregunta + respuesta) para retomarlo luego.
        // Quitamos las <action> propuestas: son efímeras y no deben re-ofrecerse
        // (ni re-ejecutarse) al recargar la conversación. Los <viz> sí se guardan.
        const stored = answer.replace(/<action>[\s\S]*?<\/action>/g, '').trim();
        if (stored && lastUser?.role === 'user') {
          try {
            await db.insert(advisorMessage).values([
              { userId, role: 'user', content: lastUser.content },
              { userId, role: 'assistant', content: stored },
            ]);
          } catch {
            // Persistir el historial es best-effort; no rompe la respuesta.
          }
        }
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
