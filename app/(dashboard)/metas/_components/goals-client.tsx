'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Plus,
  Target,
  Trophy,
  Check,
  RotateCcw,
  MoreVertical,
  Pencil,
  Trash2,
  CalendarClock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirm } from '@/components/confirm-provider';
import { DatePicker } from '@/components/date-picker';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import type { Goal } from '@/db';
import {
  createGoal,
  updateGoal,
  contributeGoal,
  toggleGoalCompleted,
  deleteGoal,
} from '../actions';

function pctOf(saved: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (saved / target) * 100));
}

function formatDate(iso: string, locale: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysLeft(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function GoalsClient({
  goals,
  locale,
  localCurrency,
}: {
  goals: Goal[];
  locale: string;
  localCurrency: string;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; goal: Goal | null }>({
    open: false,
    goal: null,
  });

  const active = goals.filter((g) => !g.completed);
  const completed = goals.filter((g) => g.completed);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Metas</h1>
          <p className="text-muted-foreground mt-1 text-base">
            Tus objetivos de ahorro: el inicial del auto, la casa, un viaje…
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, goal: null })}>
          <Plus /> Nueva meta
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
              <Target className="size-7" />
            </span>
            <div className="space-y-1">
              <p className="font-medium">Todavía no tienes metas</p>
              <p className="text-muted-foreground text-sm">
                Crea una para empezar a seguir tu progreso de ahorro.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setDialog({ open: true, goal: null })}
            >
              <Plus /> Crear meta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                locale={locale}
                onEdit={() => setDialog({ open: true, goal: g })}
              />
            ))}
          </div>

          {completed.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <Trophy className="size-4" /> Completadas ({completed.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completed.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    locale={locale}
                    onEdit={() => setDialog({ open: true, goal: g })}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <GoalDialog
        key={dialog.goal?.id ?? 'new'}
        open={dialog.open}
        goal={dialog.goal}
        localCurrency={localCurrency}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
      />
    </div>
  );
}

function GoalCard({
  goal,
  locale,
  onEdit,
}: {
  goal: Goal;
  locale: string;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const [contribution, setContribution] = useState('');

  const pct = pctOf(goal.savedAmount, goal.targetAmount);
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const fmt = (n: number) => formatMoney(n, goal.currency, locale);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? 'Ocurrió un error');
      else if (okMsg) toast.success(okMsg);
    });
  }

  function addContribution() {
    const value = Number(contribution);
    if (!contribution || Number.isNaN(value) || value === 0) return;
    setContribution('');
    run(() => contributeGoal({ id: goal.id, amount: value }), 'Abono registrado');
  }

  async function remove() {
    const ok = await confirm({
      title: 'Eliminar meta',
      description: `Se eliminará "${goal.title}". Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    run(() => deleteGoal(goal.id), 'Meta eliminada');
  }

  const days = goal.targetDate ? daysLeft(goal.targetDate) : null;

  return (
    <Card className={cn('flex flex-col', pending && 'opacity-60')}>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <Link
          href={`/metas/${goal.id}`}
          className="group flex min-w-0 items-center gap-2.5"
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${goal.color}22`, color: goal.color }}
          >
            {goal.completed ? (
              <Trophy className="size-5" />
            ) : (
              <Target className="size-5" />
            )}
          </span>
          <CardTitle className="truncate text-base group-hover:underline">
            {goal.title}
          </CardTitle>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground -mr-2 -mt-1 size-8 shrink-0"
              aria-label="Acciones de la meta"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={remove}>
              <Trash2 className="size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Barra de progreso */}
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm font-medium tabular-nums">
              {fmt(goal.savedAmount)}
            </span>
            <span className="text-muted-foreground text-xs tabular-nums">
              de {fmt(goal.targetAmount)}
            </span>
          </div>
          <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: goal.color }}
            />
          </div>
          <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs tabular-nums">
            <span>{Math.round(pct)}%</span>
            {!goal.completed && remaining > 0 && <span>faltan {fmt(remaining)}</span>}
            {goal.completed && (
              <span className="text-emerald-600 dark:text-emerald-400">
                ¡Lograda!
              </span>
            )}
          </div>
        </div>

        {/* Fecha objetivo */}
        {goal.targetDate && (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <CalendarClock className="size-3.5" />
            {formatDate(goal.targetDate, locale)}
            {!goal.completed && days !== null && (
              <span
                className={cn(
                  days < 0 && 'text-destructive',
                  days >= 0 && days <= 30 && 'text-amber-600 dark:text-amber-400'
                )}
              >
                ·{' '}
                {days < 0
                  ? `vencida hace ${-days} d`
                  : days === 0
                    ? 'es hoy'
                    : `faltan ${days} d`}
              </span>
            )}
          </p>
        )}

        <div className="mt-auto" />

        {/* Acciones */}
        {goal.completed ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={pending}
            onClick={() =>
              run(
                () => toggleGoalCompleted({ id: goal.id, completed: false }),
                'Meta reabierta'
              )
            }
          >
            <RotateCcw className="size-4" /> Reabrir
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                placeholder="Abono"
                value={contribution}
                onChange={(e) => setContribution(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addContribution();
                  }
                }}
                className="h-9 flex-1 tabular-nums"
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-9"
                onClick={addContribution}
                disabled={pending || contribution.trim() === ''}
              >
                <Plus className="size-4" /> Abonar
              </Button>
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={pending}
              onClick={() =>
                run(
                  () => toggleGoalCompleted({ id: goal.id, completed: true }),
                  '¡Meta completada!'
                )
              }
            >
              <Check className="size-4" /> Marcar completada
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GoalDialog({
  open,
  goal,
  localCurrency,
  onOpenChange,
}: {
  open: boolean;
  goal: Goal | null;
  localCurrency: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(goal?.title ?? '');
  const [target, setTarget] = useState(goal ? String(goal.targetAmount) : '');
  const [saved, setSaved] = useState(
    goal && goal.savedAmount ? String(goal.savedAmount) : ''
  );
  const [currency, setCurrency] = useState(goal?.currency ?? localCurrency);
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [note, setNote] = useState(goal?.note ?? '');
  const [color, setColor] = useState(goal?.color ?? '#10b981');

  const isEdit = goal !== null;

  function submit() {
    if (!title.trim()) {
      toast.error('Ponle un nombre a la meta');
      return;
    }
    const payload = {
      title: title.trim(),
      targetAmount: target === '' ? 0 : Number(target),
      savedAmount: saved === '' ? 0 : Number(saved),
      currency,
      targetDate: targetDate || null,
      note: note.trim() || null,
      color,
    };
    if (Number.isNaN(payload.targetAmount) || Number.isNaN(payload.savedAmount)) {
      toast.error('Los montos deben ser números');
      return;
    }
    startTransition(async () => {
      const res = isEdit
        ? await updateGoal({ id: goal.id, ...payload })
        : await createGoal(payload);
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo guardar');
        return;
      }
      toast.success(isEdit ? 'Meta actualizada' : 'Meta creada');
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar meta' : 'Nueva meta'}</DialogTitle>
          <DialogDescription>
            Define el objetivo y cuánto llevas ahorrado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="goal-title">Nombre</Label>
            <Input
              id="goal-title"
              value={title}
              placeholder="Ej. Inicial del auto"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="goal-target">Objetivo</Label>
              <Input
                id="goal-target"
                inputMode="decimal"
                value={target}
                placeholder="0"
                onChange={(e) => setTarget(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="goal-currency">Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="goal-currency" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={localCurrency}>{localCurrency}</SelectItem>
                  {localCurrency !== 'USD' && (
                    <SelectItem value="USD">USD</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="goal-saved">Ahorrado</Label>
              <Input
                id="goal-saved"
                inputMode="decimal"
                value={saved}
                placeholder="0"
                onChange={(e) => setSaved(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Fecha objetivo (opcional)</Label>
              <DatePicker
                value={targetDate}
                onChange={(iso) => setTargetDate(iso ?? '')}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="goal-note">Nota (opcional)</Label>
            <Textarea
              id="goal-note"
              value={note}
              placeholder="Detalles, para qué es, en qué cuenta ahorras…"
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              className="resize-none"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="goal-color">Color</Label>
            <Input
              id="goal-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-16 p-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {isEdit ? 'Guardar' : 'Crear meta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
