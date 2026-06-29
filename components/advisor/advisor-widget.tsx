'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, SquarePen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  '¿Cómo va mi presupuesto este mes?',
  '¿En qué puedo ahorrar?',
  'Compara los últimos dos meses',
];

/** Loader de tres puntos que saltan en secuencia. */
function TypingDots({ className }: { className?: string }) {
  return (
    <span
      className={cn('flex items-center gap-1', className)}
      role="status"
      aria-label="Generando respuesta"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

export function AdvisorWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, streaming]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;

    const history: Message[] = [...messages, { role: 'user', content }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);

    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || 'No se pudo contactar al asesor');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: acc };
          return next;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: `Ups, ${msg}.`,
        };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  function reset() {
    if (streaming) return;
    setMessages([]);
    setInput('');
  }

  const empty = messages.length === 0;

  return (
    <>
      {/* Botón flotante global */}
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir asesor financiero"
        className="fixed bottom-5 right-5 z-40 size-14 rounded-full shadow-lg ring-4 ring-primary/15 transition-transform duration-200 hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
      >
        <Sparkles className="size-6" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="gap-1 border-b p-4">
            <div className="flex items-center gap-2.5">
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
                <Sparkles className="size-5" />
              </span>
              <SheetTitle className="text-base">Asesor financiero</SheetTitle>
              <div className="ml-auto flex items-center gap-0.5">
                {!empty && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    onClick={reset}
                    disabled={streaming}
                    aria-label="Nueva conversación"
                    title="Nueva conversación"
                  >
                    <SquarePen className="size-4" />
                  </Button>
                )}
                <SheetClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    aria-label="Cerrar"
                  >
                    <X className="size-4" />
                  </Button>
                </SheetClose>
              </div>
            </div>
            <SheetDescription>
              Pregúntale por tus presupuestos y pídele ideas.
            </SheetDescription>
          </SheetHeader>

          <div
            ref={scrollRef}
            className="bg-muted/30 flex-1 space-y-5 overflow-y-auto px-4 py-5"
          >
            {empty ? (
              <div className="flex flex-col items-center gap-5 pt-8 text-center">
                <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
                  <Sparkles className="size-7" />
                </span>
                <div className="space-y-1">
                  <p className="font-medium">¿En qué te ayudo hoy?</p>
                  <p className="text-muted-foreground text-sm">
                    Analizo tus presupuestos y te doy ideas concretas.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 pt-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="bg-background hover:border-primary/40 hover:bg-accent rounded-xl border px-3.5 py-2.5 text-left text-sm shadow-sm transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => {
                const isStreamingLast =
                  streaming &&
                  i === messages.length - 1 &&
                  m.role === 'assistant';
                const isUser = m.role === 'user';
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-2.5',
                      isUser && 'flex-row-reverse'
                    )}
                  >
                    {!isUser && (
                      <span className="bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                        <Sparkles className="size-3.5" />
                      </span>
                    )}
                    <div
                      className={cn(
                        'flex min-w-0 flex-col gap-1.5',
                        isUser ? 'items-end' : 'items-start'
                      )}
                    >
                      {m.content && (
                        <div
                          className={cn(
                            'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
                            isUser
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-background rounded-tl-md'
                          )}
                        >
                          {m.content}
                        </div>
                      )}
                      {isStreamingLast && <TypingDots className="px-2 py-1" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form
            className="bg-background flex items-end gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Escribe tu pregunta…"
              rows={1}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl"
              disabled={streaming}
            />
            <Button
              type="submit"
              size="icon"
              className="size-11 shrink-0 rounded-xl"
              disabled={streaming || input.trim() === ''}
              aria-label="Enviar"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
