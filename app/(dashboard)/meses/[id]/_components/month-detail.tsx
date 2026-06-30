'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Plus,
  ArrowLeft,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Wallet,
  CreditCard,
  PiggyBank,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { CategoryIcon } from '@/components/category-icon';
import { ProgressRing } from '@/components/progress-ring';
import { periodTotals } from '@/lib/money';
import { Money, Pct } from '@/components/money';
import type { Category, Expense, Period, Goal } from '@/db';
import type { TemplateRow } from '../../../plantillas/queries';
import { StatCard } from '../../../_components/stat-card';
import { ExpenseRow } from './expense-row';
import { AddFromTemplateDialog } from './add-from-template-dialog';
import { MonthActions } from './month-actions';
import { addExpense, updatePeriodHeader, moveExpense } from '../actions';

export function MonthDetail({
  period,
  categories,
  expenses,
  templates,
  goals,
  locale = 'es-UY',
  displayCurrency = 'local',
}: {
  period: Period;
  categories: Category[];
  expenses: Expense[];
  templates: TemplateRow[];
  goals: Goal[];
  locale?: string;
  displayCurrency?: 'local' | 'usd';
}) {
  const [pending, startTransition] = useTransition();
  const [income, setIncome] = useState(String(period.incomeTotal));
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, true]))
  );

  // Orden local de los gastos (para drag-and-drop optimista). Se resincroniza
  // en el render cuando el servidor envía nuevos datos (alta/edición/baja/
  // revalidación), sin usar un efecto.
  const [items, setItems] = useState<Expense[]>(expenses);
  const [prevExpenses, setPrevExpenses] = useState(expenses);
  if (expenses !== prevExpenses) {
    setPrevExpenses(expenses);
    setItems(expenses);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ¿En qué categoría está un id? (un id puede ser un gasto o una categoría vacía)
  function containerOf(list: Expense[], id: string): string | undefined {
    if (categories.some((c) => c.id === id)) return id;
    return list.find((e) => e.id === id)?.categoryId;
  }

  // Mientras se arrastra entre categorías, mueve el ítem de categoría (optimista).
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setItems((prev) => {
      const activeItem = prev.find((e) => e.id === activeId);
      if (!activeItem) return prev;
      const overContainer = containerOf(prev, overId);
      if (!overContainer || activeItem.categoryId === overContainer) return prev;

      const without = prev.filter((e) => e.id !== activeId);
      const moved = { ...activeItem, categoryId: overContainer };
      const overIsContainer = categories.some((c) => c.id === overId);
      if (!overIsContainer) {
        const idx = without.findIndex((e) => e.id === overId);
        if (idx === -1) return [...without, moved];
        return [...without.slice(0, idx), moved, ...without.slice(idx)];
      }
      // Soltado sobre una categoría vacía / su zona: al final de esa categoría.
      let lastIdx = -1;
      without.forEach((e, i) => {
        if (e.categoryId === overContainer) lastIdx = i;
      });
      return [...without.slice(0, lastIdx + 1), moved, ...without.slice(lastIdx + 1)];
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const activeItem = items.find((e) => e.id === activeId);
    if (!activeItem) return;
    const container = activeItem.categoryId; // ya refleja el destino tras dragOver

    let next = items;
    const overItem = items.find((e) => e.id === overId);
    if (overItem && overItem.categoryId === container && overId !== activeId) {
      const ids = items.filter((e) => e.categoryId === container).map((e) => e.id);
      const oldIndex = ids.indexOf(activeId);
      const newIndex = ids.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(ids, oldIndex, newIndex);
        const byId = new Map(items.map((e) => [e.id, e]));
        const queue = reordered.map((id) => byId.get(id)!);
        let qi = 0;
        next = items.map((e) => (e.categoryId === container ? queue[qi++] : e));
        setItems(next);
      }
    }

    const orderedIds = next
      .filter((e) => e.categoryId === container)
      .map((e) => e.id);
    startTransition(async () => {
      const res = await moveExpense({
        id: activeId,
        periodId: period.id,
        toCategoryId: container,
        orderedIds,
      });
      if (!res.ok) toast.error(res.error ?? 'No se pudo mover');
    });
  }

  // Totales en vivo según lo que se está editando. La cotización es la del mes.
  const incomeNum = income.trim() === '' ? 0 : Number(income);
  const liveIncome = Number.isNaN(incomeNum) ? period.incomeTotal : incomeNum;
  const liveRate = period.dollarRate;
  const localCurrency = period.localCurrency;

  // Moneda en la que se muestran los totales.
  const showUsd = displayCurrency === 'usd';
  const dispCode = showUsd ? 'USD' : localCurrency;
  const altCode = showUsd ? localCurrency : 'USD';
  const toDisp = (local: number) => (showUsd ? (liveRate > 0 ? local / liveRate : 0) : local);
  const toAlt = (local: number) => (showUsd ? local : liveRate > 0 ? local / liveRate : 0);

  const totals = useMemo(
    () => periodTotals(expenses, liveRate, liveIncome),
    [expenses, liveRate, liveIncome]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const c of categories) map.set(c.id, []);
    for (const e of items) {
      if (!map.has(e.categoryId)) map.set(e.categoryId, []);
      map.get(e.categoryId)!.push(e);
    }
    return map;
  }, [categories, items]);

  // Plantillas ya presentes en el mes (clave categoría|concepto), para no
  // ofrecerlas de nuevo en "Agregar desde plantilla".
  const takenTemplateKeys = useMemo(
    () =>
      new Set(
        items.map((e) => `${e.categoryId}|${e.concept.trim().toLowerCase()}`)
      ),
    [items]
  );

  const allOpen = categories.every((c) => openMap[c.id] !== false);
  const storageKey = `finanzas:collapsed:${period.id}`;

  function persist(map: Record<string, boolean>) {
    try {
      const closed = categories.filter((c) => map[c.id] === false).map((c) => c.id);
      localStorage.setItem(storageKey, JSON.stringify(closed));
    } catch {}
  }

  function setSection(id: string, open: boolean) {
    setOpenMap((s) => {
      const next = { ...s, [id]: open };
      persist(next);
      return next;
    });
  }

  function toggleAll() {
    const next = Object.fromEntries(categories.map((c) => [c.id, !allOpen]));
    persist(next);
    setOpenMap(next);
  }

  // Restaura el estado colapsado/expandido guardado para este mes.
  useEffect(() => {
    const restore = (closed: string[]) =>
      setOpenMap(
        Object.fromEntries(categories.map((c) => [c.id, !closed.includes(c.id)]))
      );
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) restore(JSON.parse(raw));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function saveHeader() {
    if (Number.isNaN(incomeNum)) return;
    if (incomeNum === period.incomeTotal) return;
    startTransition(async () => {
      const res = await updatePeriodHeader({
        id: period.id,
        incomeTotal: incomeNum,
        dollarRate: period.dollarRate,
      });
      if (!res.ok) toast.error(res.error ?? 'Error al guardar');
    });
  }

  function handleAdd(categoryId: string) {
    setOpenMap((s) => ({ ...s, [categoryId]: true }));
    startTransition(async () => {
      const res = await addExpense({
        periodId: period.id,
        categoryId,
        concept: 'Nuevo gasto',
        amount: 0,
        currency: localCurrency,
      });
      if (!res.ok) toast.error(res.error ?? 'Error al agregar');
    });
  }

  const pct = Math.min(100, Math.max(0, totals.pctUsado));
  const overBudget = totals.restante < 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/meses" aria-label="Volver">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">{period.label}</h1>
        </div>
        <Badge variant={period.status === 'open' ? 'default' : 'secondary'}>
          {period.status === 'open' ? 'Abierto' : 'Cerrado'}
        </Badge>
        <AddFromTemplateDialog
          periodId={period.id}
          templates={templates}
          taken={takenTemplateKeys}
        />
        <MonthActions
          periodId={period.id}
          label={period.label}
          status={period.status}
        />
      </div>

      {/* Resumen del mes */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ingreso total"
          value={<Money animateOnMount value={toDisp(liveIncome)} currency={dispCode} locale={locale} />}
          sub={<Money animateOnMount value={toAlt(liveIncome)} currency={altCode} locale={locale} />}
          accent="primary"
          icon={<Wallet className="size-6" />}
        />
        <StatCard
          label="Total utilizado"
          value={<Money animateOnMount value={toDisp(totals.totalLocal)} currency={dispCode} locale={locale} />}
          sub={<Money animateOnMount value={toAlt(totals.totalLocal)} currency={altCode} locale={locale} />}
          accent="sky"
          icon={<CreditCard className="size-6" />}
        />
        <StatCard
          label="Restante"
          value={<Money animateOnMount value={toDisp(totals.restante)} currency={dispCode} locale={locale} />}
          sub={<Money animateOnMount value={toAlt(totals.restante)} currency={altCode} locale={locale} />}
          valueClass={overBudget ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}
          accent={overBudget ? 'rose' : 'emerald'}
          icon={<PiggyBank className="size-6" />}
        />
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="flex flex-col items-center justify-center gap-3">
            <ProgressRing
              value={pct}
              size={104}
              strokeWidth={11}
              indicatorClassName={cn(
                overBudget ? 'stroke-destructive' : pct > 90 ? 'stroke-amber-500' : 'stroke-primary'
              )}
            >
              <div className="flex flex-col items-center leading-none">
                <Pct animateOnMount value={totals.pctUsado} className="text-2xl font-semibold tabular-nums" />
                <span className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">
                  usado
                </span>
              </div>
            </ProgressRing>
            <p className="text-muted-foreground text-center text-xs tabular-nums">
              <Money
                value={toDisp(totals.pagadoLocal)}
                currency={dispCode}
                locale={locale}
                className="text-emerald-600 dark:text-emerald-400 font-medium"
              />{' '}
              pagado ·{' '}
              <Money
                value={toDisp(totals.pendienteLocal)}
                currency={dispCode}
                locale={locale}
                className="text-amber-600 dark:text-amber-400 font-medium"
              />{' '}
              pend.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ajustes del mes */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="income">Ingreso total ({localCurrency})</Label>
            <Input
              id="income"
              inputMode="decimal"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              onBlur={saveHeader}
              className="w-48 tabular-nums"
            />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Dólar del mes</p>
            <p className="text-base font-medium tabular-nums">
              $ {liveRate} <span className="text-muted-foreground text-xs">{localCurrency}/USD</span>
            </p>
            <p className="text-muted-foreground text-xs">
              La cotización se ajusta arriba, en el header.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {categories.length} categoría(s) · {expenses.length} gasto(s)
        </p>
        <Button variant="ghost" size="sm" onClick={toggleAll}>
          {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
          {allOpen ? 'Colapsar todo' : 'Expandir todo'}
        </Button>
      </div>

      {/* Secciones por categoría (colapsables). Un solo DndContext permite
          reordenar dentro de una categoría y mover gastos entre categorías. */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        autoScroll={false}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
      <div className="flex flex-col gap-4">
        {categories.map((cat) => {
          const rows = grouped.get(cat.id) ?? [];
          const catTotal = rows.reduce(
            (s, e) => s + (e.currency === 'USD' ? e.amount * liveRate : e.amount),
            0
          );
          const open = openMap[cat.id] !== false;
          return (
            <Collapsible
              key={cat.id}
              open={open}
              onOpenChange={(o) => setSection(cat.id, o)}
            >
              <div className="bg-card ring-border/60 overflow-hidden rounded-xl shadow-sm ring-1">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="group hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-9 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${cat.color}33`, color: cat.color }}
                      >
                        <CategoryIcon name={cat.icon} className="size-5" />
                      </span>
                      <span className="font-semibold">{cat.name}</span>
                      <Badge variant="secondary" className="rounded-full">
                        {rows.length}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <Money animateOnMount value={toDisp(catTotal)} currency={dispCode} locale={locale} className="text-base font-semibold tabular-nums" />
                      <ChevronDown className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180" />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead className="px-4">Concepto</TableHead>
                          <TableHead className="w-32 px-4 text-right">Monto</TableHead>
                          <TableHead className="w-20 px-4">Mon.</TableHead>
                          <TableHead className="w-28 px-4 text-right">USD aprox</TableHead>
                          <TableHead className="w-32 px-4">Estado</TableHead>
                          <TableHead className="w-36 px-4">Vencimiento</TableHead>
                          <TableHead className="w-44 px-4">Meta</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <CategoryRows
                        categoryId={cat.id}
                        rows={rows}
                        rate={liveRate}
                        localCurrency={localCurrency}
                        locale={locale}
                        goals={goals}
                      />
                    </Table>
                    <div className="px-2 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => handleAdd(cat.id)}
                        disabled={pending}
                      >
                        <Plus className="size-4" /> Agregar gasto
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
      </DndContext>
    </div>
  );
}

/** Cuerpo de tabla de una categoría: droppable + sortable + filas. */
function CategoryRows({
  categoryId,
  rows,
  rate,
  localCurrency,
  locale,
  goals,
}: {
  categoryId: string;
  rows: Expense[];
  rate: number;
  localCurrency: string;
  locale: string;
  goals: Goal[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: categoryId });
  return (
    <TableBody ref={setNodeRef} className={cn(isOver && 'bg-primary/5')}>
      <SortableContext
        items={rows.map((e) => e.id)}
        strategy={verticalListSortingStrategy}
      >
        {rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={9}
              className="text-muted-foreground py-6 text-center text-sm"
            >
              Arrastra un gasto aquí o usa «Agregar gasto».
            </TableCell>
          </TableRow>
        ) : (
          rows.map((e, i) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              order={i + 1}
              rate={rate}
              localCurrency={localCurrency}
              locale={locale}
              goals={goals}
            />
          ))
        )}
      </SortableContext>
    </TableBody>
  );
}

