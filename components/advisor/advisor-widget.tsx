'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  Send,
  SquarePen,
  X,
  Check,
  Zap,
  TriangleAlert,
  CircleAlert,
  CircleCheck,
} from 'lucide-react';
import { toast } from 'sonner';
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
import {
  executeAdvisorAction,
  getAdvisorHistory,
  getAdvisorInsights,
  clearAdvisorHistory,
} from '@/app/api/advisor/actions';
import type { AdvisorInsight } from '@/lib/advisor-context';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type Viz =
  | { kind: 'progress'; label: string; value: number; caption?: string }
  | {
      kind: 'compare';
      title?: string;
      rows: { label: string; before: number | string; after: number | string; unit?: string }[];
    }
  | { kind: 'stat'; label: string; value: string; hint?: string };

type AdvisorAction =
  | { type: 'add_expense'; category: string; concept: string; amount: number; currency?: string }
  | { type: 'mark_paid'; concept: string }
  | { type: 'create_goal'; title: string; target: number; currency?: string; targetDate?: string | null }
  | { type: 'contribute_goal'; goal: string; amount: number }
  | { type: 'create_month'; year: number; month: number; copyFromMonth?: number; copyFromYear?: number }
  | { type: 'set_income'; amount: number; dollarRate?: number }
  | { type: 'edit_expense'; concept: string; amount?: number; currency?: string; dueDate?: string | null; status?: 'pendiente' | 'pagado' | 'vencido' }
  | { type: 'delete_expense'; concept: string }
  | { type: 'create_category'; name: string; icon?: string; color?: string }
  | { type: 'complete_goal'; goal: string }
  | { type: 'update_goal'; goal: string; target?: number; targetDate?: string | null }
  | { type: 'set_recurring'; concept: string; recurring: boolean }
  | { type: 'create_installment'; concept: string; category: string; installmentAmount: number; installments: number; currency?: string }
  | { type: 'convert_to_installments'; concept: string; installments: number; amountIsTotal?: boolean }
  | { type: 'create_saving_account'; name: string; currency?: string; initialBalance?: number }
  | { type: 'add_saving'; account: string; amount: number; kind?: 'deposit' | 'withdraw' };

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function monthName(m: number): string {
  return MONTHS_ES[m - 1] ?? String(m);
}

/**
 * Separa el texto visible de las acciones propuestas (<action>{...}</action>) y
 * de los visuales (<viz>{...}</viz>).
 */
function parseAdvisorContent(raw: string): {
  text: string;
  actions: AdvisorAction[];
  vizzes: Viz[];
} {
  const actions: AdvisorAction[] = [];
  const vizzes: Viz[] = [];
  const re = /<(action|viz)>([\s\S]*?)<\/\1>/g;
  let cleaned = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    cleaned += raw.slice(last, m.index);
    try {
      const obj = JSON.parse(m[2].trim());
      if (m[1] === 'action' && obj && typeof obj.type === 'string') {
        actions.push(obj as AdvisorAction);
      } else if (m[1] === 'viz' && obj && typeof obj.kind === 'string') {
        vizzes.push(obj as Viz);
      }
    } catch {
      // JSON inválido: se ignora
    }
    last = re.lastIndex;
  }
  cleaned += raw.slice(last);
  // Oculta una etiqueta abierta sin cerrar (mientras llega por streaming).
  for (const tag of ['<action>', '<viz>']) {
    const open = cleaned.lastIndexOf(tag);
    const close = `</${tag.slice(1)}`;
    if (open !== -1 && !cleaned.slice(open).includes(close)) {
      cleaned = cleaned.slice(0, open);
    }
  }
  return { text: cleaned.trim(), actions, vizzes };
}

function actionLabel(a: AdvisorAction): string {
  switch (a.type) {
    case 'add_expense':
      return `Agregar gasto: ${a.concept} · ${a.amount} ${a.currency ?? ''} en ${a.category}`.replace(
        / +/g,
        ' '
      );
    case 'mark_paid':
      return `Marcar como pagado: ${a.concept}`;
    case 'create_goal':
      return `Crear meta: ${a.title} · objetivo ${a.target} ${a.currency ?? ''}`.trim();
    case 'contribute_goal':
      return `Abonar ${a.amount} a la meta «${a.goal}»`;
    case 'create_month': {
      const base = a.copyFromMonth
        ? ` (copiando ${monthName(a.copyFromMonth)})`
        : '';
      return `Crear mes: ${monthName(a.month)} de ${a.year}${base}`;
    }
    case 'set_income':
      return `Definir ingreso del mes: ${a.amount}`;
    case 'edit_expense': {
      const parts: string[] = [];
      if (a.amount !== undefined) parts.push(`monto ${a.amount}`);
      if (a.currency) parts.push(a.currency);
      if (a.dueDate) parts.push(`vence ${a.dueDate}`);
      if (a.status) parts.push(a.status);
      return `Editar gasto: ${a.concept}${parts.length ? ` → ${parts.join(', ')}` : ''}`;
    }
    case 'delete_expense':
      return `Eliminar gasto: ${a.concept}`;
    case 'create_category':
      return `Crear categoría: ${a.name}`;
    case 'complete_goal':
      return `Marcar meta como completada: «${a.goal}»`;
    case 'update_goal': {
      const parts: string[] = [];
      if (a.target !== undefined) parts.push(`objetivo ${a.target}`);
      if (a.targetDate) parts.push(`fecha ${a.targetDate}`);
      return `Actualizar meta «${a.goal}»${parts.length ? ` → ${parts.join(', ')}` : ''}`;
    }
    case 'set_recurring':
      return a.recurring
        ? `Marcar como recurrente: ${a.concept}`
        : `Quitar de recurrentes: ${a.concept}`;
    case 'create_installment':
      return `Compra en cuotas: ${a.concept} · ${a.installments} cuotas de ${a.installmentAmount} ${a.currency ?? ''} en ${a.category}`.replace(
        / +/g,
        ' '
      );
    case 'convert_to_installments':
      return `Convertir en ${a.installments} cuotas: ${a.concept}`;
    case 'create_saving_account':
      return `Crear apartado de ahorro: ${a.name}${a.initialBalance ? ` · saldo inicial ${a.initialBalance} ${a.currency ?? ''}` : ''}`.trim();
    case 'add_saving':
      return a.kind === 'withdraw'
        ? `Retirar ${a.amount} de «${a.account}»`
        : `Depositar ${a.amount} en «${a.account}»`;
  }
}

// Prompts iniciales. El primero de cada lista es el más específico a la página;
// el resto cubre análisis, ahorro, simulaciones, metas y acciones.
const GENERAL_SUGGESTIONS = [
  '¿Cómo va mi presupuesto este mes?',
  '¿En qué puedo ahorrar?',
  '¿En qué se me va más plata?',
  '¿Qué pasa si gasto $5.000 menos este mes?',
  '¿Qué gastos tengo por pagar?',
  '¿Cuánto debo ahorrar por mes para mi meta?',
  'Compara este mes con el anterior',
  'Dame un plan para llegar a fin de mes',
];

const MONTH_SUGGESTIONS = [
  'Analiza este mes',
  '¿Dónde puedo recortar este mes?',
  '¿Qué gastos me quedan por pagar?',
  '¿Voy a cerrar el mes en positivo?',
  '¿Qué pasa si subo el alquiler un 10%?',
  'Detecta gastos que puedo bajar o cancelar',
];

const GOALS_SUGGESTIONS = [
  '¿Voy bien con mis metas?',
  '¿Cuánto ahorrar por mes para llegar?',
  '¿Cuál meta debería priorizar?',
  '¿Cuándo alcanzo mi meta a este ritmo?',
  'Propón un abono para mi meta principal',
];

const CATEGORIES_SUGGESTIONS = [
  '¿Qué categoría se me va de las manos?',
  '¿Cómo reparto mejor mi presupuesto?',
  'Sugiere categorías que me falten',
  '¿Qué categoría creció más entre meses?',
];

/** Sugerencias contextuales según la página donde está abierto el asesor. */
function pageSuggestions(pathname: string): string[] {
  if (/^\/meses(\/|$)/.test(pathname)) return MONTH_SUGGESTIONS;
  if (pathname.startsWith('/metas')) return GOALS_SUGGESTIONS;
  if (pathname.startsWith('/categorias')) return CATEGORIES_SUGGESTIONS;
  return GENERAL_SUGGESTIONS;
}

function fmtNum(v: number | string): string {
  return typeof v === 'number' ? v.toLocaleString('es-UY') : v;
}

/** Barras/comparativas/estadísticas que el asesor puede emitir con <viz>. */
function VizCard({ viz }: { viz: Viz }) {
  if (viz.kind === 'progress') {
    const pct = Math.max(0, Math.min(100, viz.value));
    const tone =
      pct > 100 ? 'bg-destructive' : pct >= 85 ? 'bg-amber-500' : 'bg-primary';
    return (
      <div className="bg-background w-full max-w-[92%] space-y-1.5 rounded-xl border px-3 py-2.5 shadow-sm">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">{viz.label}</span>
          <span className="text-muted-foreground tabular-nums">{pct.toFixed(0)}%</span>
        </div>
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
        </div>
        {viz.caption && (
          <p className="text-muted-foreground text-xs">{viz.caption}</p>
        )}
      </div>
    );
  }

  if (viz.kind === 'compare') {
    return (
      <div className="bg-background w-full max-w-[92%] space-y-2 rounded-xl border px-3 py-2.5 shadow-sm">
        {viz.title && <p className="text-sm font-medium">{viz.title}</p>}
        <div className="space-y-1.5">
          {viz.rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground min-w-0 truncate">{r.label}</span>
              <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                <span className="text-muted-foreground line-through">{fmtNum(r.before)}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{fmtNum(r.after)}</span>
                {r.unit && <span className="text-muted-foreground text-xs">{r.unit}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex w-full max-w-[92%] items-baseline justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-sm">
      <span className="text-muted-foreground min-w-0 truncate">{viz.label}</span>
      <span className="shrink-0 font-medium tabular-nums">{viz.value}</span>
    </div>
  );
}

const INSIGHT_STYLE: Record<
  AdvisorInsight['level'],
  { icon: typeof CircleCheck; className: string }
> = {
  ok: { icon: CircleCheck, className: 'text-emerald-600 dark:text-emerald-400' },
  warn: { icon: CircleAlert, className: 'text-amber-600 dark:text-amber-400' },
  alert: { icon: TriangleAlert, className: 'text-destructive' },
};

/** Panel proactivo con el chequeo de salud financiera al abrir. */
function InsightsPanel({ insights }: { insights: AdvisorInsight[] }) {
  return (
    <div className="bg-background w-full space-y-2 rounded-2xl border p-3 text-left shadow-sm">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Tu situación ahora
      </p>
      <ul className="space-y-2">
        {insights.map((ins, i) => {
          const { icon: Icon, className } = INSIGHT_STYLE[ins.level];
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Icon className={cn('mt-0.5 size-4 shrink-0', className)} />
              <span className="leading-snug">{ins.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
  const [actionState, setActionState] = useState<
    Record<string, 'running' | 'done' | 'dismissed'>
  >({});
  const [insights, setInsights] = useState<AdvisorInsight[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const pathname = usePathname();

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, streaming]);

  // Al abrir por primera vez, recupera la conversación guardada y el chequeo.
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      const [history, ins] = await Promise.all([
        getAdvisorHistory(),
        getAdvisorInsights(),
      ]);
      if (history.length > 0) setMessages(history);
      setInsights(ins);
    })();
  }, [open]);

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
    setActionState({});
    void clearAdvisorHistory();
  }

  function confirmAction(key: string, action: AdvisorAction) {
    setActionState((s) => ({ ...s, [key]: 'running' }));
    executeAdvisorAction(action).then((res) => {
      if (res.ok) {
        setActionState((s) => ({ ...s, [key]: 'done' }));
        toast.success('Listo, lo hice');
      } else {
        toast.error(res.error ?? 'No se pudo realizar la acción');
        setActionState((s) => {
          const next = { ...s };
          delete next[key];
          return next;
        });
      }
    });
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
              <div className="flex flex-col items-center gap-5 pt-2 text-center">
                <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
                  <Sparkles className="size-7" />
                </span>
                <div className="space-y-1">
                  <p className="font-medium">¿En qué te ayudo hoy?</p>
                  <p className="text-muted-foreground text-sm">
                    Analizo tus presupuestos y te doy ideas concretas.
                  </p>
                </div>
                {insights.length > 0 && <InsightsPanel insights={insights} />}
                <div className="flex w-full flex-col gap-2 pt-1">
                  {pageSuggestions(pathname).map((s) => (
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
                const parsed = isUser
                  ? { text: m.content, actions: [] as AdvisorAction[], vizzes: [] as Viz[] }
                  : parseAdvisorContent(m.content);
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
                        isUser ? 'items-end' : 'w-full items-start'
                      )}
                    >
                      {parsed.text && (
                        <div
                          className={cn(
                            'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
                            isUser
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-background rounded-tl-md'
                          )}
                        >
                          {parsed.text}
                        </div>
                      )}

                      {/* Visuales (barras, comparativas) que emite el asesor */}
                      {parsed.vizzes.map((v, vi) => (
                        <VizCard key={`v${vi}`} viz={v} />
                      ))}

                      {/* Acciones propuestas por el asesor */}
                      {parsed.actions.map((a, ai) => {
                        const key = `${i}:${ai}`;
                        const st = actionState[key];
                        return (
                          <div
                            key={ai}
                            className="bg-background flex w-full max-w-[92%] items-center gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm"
                          >
                            <Zap className="text-primary size-4 shrink-0" />
                            <span className="min-w-0 flex-1">{actionLabel(a)}</span>
                            {st === 'done' ? (
                              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                <Check className="size-3.5" /> Hecho
                              </span>
                            ) : st === 'dismissed' ? (
                              <span className="text-muted-foreground shrink-0 text-xs">
                                Descartado
                              </span>
                            ) : (
                              <span className="flex shrink-0 items-center gap-1">
                                <Button
                                  size="sm"
                                  className="h-7"
                                  disabled={st === 'running'}
                                  onClick={() => confirmAction(key, a)}
                                >
                                  {st === 'running' ? '…' : 'Confirmar'}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  aria-label="Descartar"
                                  disabled={st === 'running'}
                                  onClick={() =>
                                    setActionState((s) => ({
                                      ...s,
                                      [key]: 'dismissed',
                                    }))
                                  }
                                >
                                  <X className="size-4" />
                                </Button>
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {isStreamingLast && <TypingDots className="px-2 py-1" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {!empty && !streaming && (
            <div className="bg-background flex flex-wrap gap-1.5 border-t px-3 pt-2.5">
              {pageSuggestions(pathname).slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground rounded-full border px-3 py-1 text-xs transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className={cn(
              'bg-background flex items-end gap-2 p-3',
              (empty || streaming) && 'border-t'
            )}
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
