'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Target,
  Check,
  RotateCcw,
  Plus,
  Pencil,
  Trash2,
  CalendarClock,
  MoreVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { ProgressRing } from '@/components/progress-ring';
import { CategoryIcon } from '@/components/category-icon';
import { useAnimations } from '@/components/animations-provider';
import { TrendingUp } from 'lucide-react';
import { useConfirm } from '@/components/confirm-provider';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import type { Goal, GoalContribution } from '@/db';
import { GoalDialog } from '../../_components/goals-client';
import {
  contributeGoal,
  toggleGoalCompleted,
  deleteGoal,
  deleteContribution,
} from '../../actions';

function formatDate(iso: string, locale: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(date: Date, locale: string) {
  return new Date(date).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatShort(date: Date, locale: string) {
  return new Date(date).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
  });
}

function daysLeft(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round(
    (new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86_400_000
  );
}

/**
 * Serie acumulada de ahorro + ritmo/proyección a partir del historial de abonos.
 * Vive a nivel de módulo (fuera del render) para mantener el componente puro.
 */
function computeGoalInsights(
  goal: Goal,
  contributions: GoalContribution[],
  locale: string
) {
  const asc = [...contributions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const totalContrib = contributions.reduce((s, c) => s + c.amount, 0);
  const baseline = Math.max(0, goal.savedAmount - totalContrib);

  const chartData: { label: string; saved: number }[] = [
    { label: formatShort(goal.createdAt, locale), saved: baseline },
  ];
  let running = baseline;
  for (const c of asc) {
    running = Math.max(0, running + c.amount);
    chartData.push({ label: formatShort(c.createdAt, locale), saved: running });
  }

  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  let pace: number | null = null;
  let projectedDate: Date | null = null;
  let onTrack: boolean | null = null;
  if (asc.length > 0 && totalContrib > 0) {
    const firstMs = new Date(asc[0].createdAt).getTime();
    const spanMonths = Math.max(1, (Date.now() - firstMs) / (30 * 86_400_000));
    pace = totalContrib / spanMonths;
    if (remaining > 0 && pace > 0) {
      projectedDate = new Date(Date.now() + (remaining / pace) * 30 * 86_400_000);
      if (goal.targetDate) {
        onTrack =
          projectedDate.getTime() <=
          new Date(`${goal.targetDate}T23:59:59`).getTime();
      }
    }
  }

  return { chartData, pace, projectedDate, onTrack, showChart: asc.length >= 2 };
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', className)}>
        {value}
      </p>
    </div>
  );
}

export function GoalDetail({
  goal,
  contributions,
  locale,
  localCurrency,
}: {
  goal: Goal;
  contributions: GoalContribution[];
  locale: string;
  localCurrency: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const animations = useAnimations();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const fmt = (n: number) => formatMoney(n, goal.currency, locale);
  const pct =
    goal.targetAmount > 0
      ? Math.min(100, Math.max(0, (goal.savedAmount / goal.targetAmount) * 100))
      : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const days = goal.targetDate ? daysLeft(goal.targetDate) : null;
  const monthsLeft = days !== null ? Math.max(1, Math.ceil(days / 30)) : null;
  const perMonth =
    monthsLeft && remaining > 0 ? remaining / monthsLeft : null;

  const { chartData, pace, projectedDate, onTrack, showChart } =
    computeGoalInsights(goal, contributions, locale);
  const chartConfig: ChartConfig = {
    saved: { label: 'Ahorrado', color: goal.color },
  };
  const showProjection = !goal.completed && pace !== null;

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg?: string
  ) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? 'Ocurrió un error');
      else if (okMsg) toast.success(okMsg);
    });
  }

  function addContribution() {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value === 0) return;
    setAmount('');
    setNote('');
    run(
      () => contributeGoal({ id: goal.id, amount: value, note: note.trim() || null }),
      'Abono registrado'
    );
  }

  async function removeGoal() {
    const ok = await confirm({
      title: 'Eliminar meta',
      description: `Se eliminará "${goal.title}" y su historial. No se puede deshacer.`,
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteGoal(goal.id);
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo eliminar');
        return;
      }
      toast.success('Meta eliminada');
      router.push('/metas');
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/metas" aria-label="Volver a metas">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${goal.color}22`, color: goal.color }}
        >
          <CategoryIcon name={goal.icon} className="size-5" />
        </span>
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">
          {goal.title}
        </h1>
        {goal.completed && (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            Completada
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Acciones">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={removeGoal}>
              <Trash2 className="size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Resumen */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-8">
          <ProgressRing
            value={pct}
            size={120}
            strokeWidth={12}
            indicatorClassName={
              goal.completed ? 'stroke-emerald-500' : 'stroke-primary'
            }
          >
            <div className="flex flex-col items-center leading-none">
              <span className="text-2xl font-semibold tabular-nums">
                {Math.round(pct)}%
              </span>
              <span className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">
                logrado
              </span>
            </div>
          </ProgressRing>

          <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
            <Stat label="Ahorrado" value={fmt(goal.savedAmount)} />
            <Stat label="Objetivo" value={fmt(goal.targetAmount)} />
            <Stat
              label="Falta"
              value={fmt(remaining)}
              className={remaining === 0 ? 'text-emerald-600 dark:text-emerald-400' : undefined}
            />
            {goal.targetDate && (
              <Stat
                label="Fecha objetivo"
                value={formatDate(goal.targetDate, locale)}
              />
            )}
            {days !== null && !goal.completed && (
              <Stat
                label="Tiempo"
                value={
                  days < 0
                    ? `vencida hace ${-days} d`
                    : days === 0
                      ? 'es hoy'
                      : `faltan ${days} d`
                }
                className={cn(
                  'text-base',
                  days < 0 && 'text-destructive',
                  days >= 0 && days <= 30 && 'text-amber-600 dark:text-amber-400'
                )}
              />
            )}
            {perMonth !== null && !goal.completed && (
              <Stat label="Necesitas / mes" value={fmt(perMonth)} />
            )}
          </div>
        </CardContent>
      </Card>

      {goal.note && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nota</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">
              {goal.note}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Proyección */}
      {showProjection && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="text-primary size-4" /> Proyección
            </CardTitle>
            {onTrack !== null && remaining > 0 && (
              <Badge
                className={cn(
                  onTrack
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                )}
              >
                {onTrack ? 'En camino' : 'Atrasado'}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
            <Stat label="Ritmo de ahorro" value={`${fmt(pace!)} / mes`} />
            {remaining > 0 ? (
              <Stat
                label="Logro estimado"
                value={projectedDate ? formatDateTime(projectedDate, locale) : '—'}
              />
            ) : (
              <Stat
                label="Estado"
                value="Objetivo alcanzado"
                className="text-emerald-600 dark:text-emerald-400"
              />
            )}
            {perMonth !== null && (
              <Stat label="Necesitas / mes" value={fmt(perMonth)} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Evolución del ahorro */}
      {showChart && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolución del ahorro</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="max-h-[260px] w-full">
              <AreaChart data={chartData} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  hide
                  domain={[0, Math.max(goal.targetAmount, goal.savedAmount)]}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="font-medium tabular-nums">
                          {fmt(Number(value))}
                        </span>
                      )}
                    />
                  }
                />
                {goal.targetAmount > 0 && (
                  <ReferenceLine
                    y={goal.targetAmount}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Objetivo',
                      position: 'insideTopRight',
                      fontSize: 10,
                      fill: 'var(--muted-foreground)',
                    }}
                  />
                )}
                <Area
                  dataKey="saved"
                  type="monotone"
                  stroke={goal.color}
                  fill={goal.color}
                  fillOpacity={0.2}
                  isAnimationActive={animations}
                  animationDuration={550}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Acciones */}
      {goal.completed ? (
        <Button
          variant="outline"
          className="w-fit"
          disabled={pending}
          onClick={() =>
            run(
              () => toggleGoalCompleted({ id: goal.id, completed: false }),
              'Meta reabierta'
            )
          }
        >
          <RotateCcw className="size-4" /> Reabrir meta
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar abono</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="contrib-amount">
                Monto
              </label>
              <Input
                id="contrib-amount"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addContribution()}
                className="w-36 tabular-nums"
              />
            </div>
            <div className="grid flex-1 gap-1.5">
              <label className="text-sm font-medium" htmlFor="contrib-note">
                Nota (opcional)
              </label>
              <Input
                id="contrib-note"
                placeholder="Ej. sueldo de julio"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addContribution()}
              />
            </div>
            <Button
              onClick={addContribution}
              disabled={pending || amount.trim() === ''}
            >
              <Plus className="size-4" /> Abonar
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                run(
                  () => toggleGoalCompleted({ id: goal.id, completed: true }),
                  '¡Meta completada!'
                )
              }
            >
              <Check className="size-4" /> Completar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Historial */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de abonos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {contributions.length === 0 ? (
            <p className="text-muted-foreground px-6 pb-6 text-sm">
              Sin abonos registrados todavía.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {contributions.map((c) => {
                const auto = c.expenseId !== null;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-6 py-3">
                    {auto ? (
                      <Target className="text-muted-foreground size-4 shrink-0" />
                    ) : (
                      <CalendarClock className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {formatDateTime(c.createdAt, locale)}
                        {c.note && (
                          <span className="text-muted-foreground"> · {c.note}</span>
                        )}
                      </p>
                      {auto && (
                        <p className="text-muted-foreground text-xs">
                          Automático (gasto pagado)
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-sm font-medium tabular-nums',
                        c.amount < 0
                          ? 'text-destructive'
                          : 'text-emerald-600 dark:text-emerald-400'
                      )}
                    >
                      {c.amount < 0 ? '' : '+'}
                      {fmt(c.amount)}
                    </span>
                    {!auto && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                        aria-label="Eliminar abono"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => deleteContribution({ id: c.id }),
                            'Abono eliminado'
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <GoalDialog
        key={goal.id + String(editing)}
        open={editing}
        goal={goal}
        localCurrency={localCurrency}
        onOpenChange={setEditing}
      />
    </div>
  );
}
