'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Plus,
  ArrowLeft,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  Wallet,
  CreditCard,
  PiggyBank,
  RefreshCw,
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
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import {
  addExpense,
  updatePeriodHeader,
  moveExpense,
  fetchMarketRate,
} from '../actions';
import { reorderCategories } from '../../../categorias/actions';

/** Parsea un número tolerando coma decimal y separadores de miles (es-UY/AR). */
function parseAmount(v: string): number {
  return Number(v.trim().replace(/\s/g, '').replace(',', '.'));
}

export function MonthDetail({
  period,
  categories,
  expenses,
  templates,
  goals,
  otherPeriods = [],
  locale = 'es-UY',
  displayCurrency = 'local',
}: {
  period: Period;
  categories: Category[];
  expenses: Expense[];
  templates: TemplateRow[];
  goals: Goal[];
  otherPeriods?: { id: string; label: string }[];
  locale?: string;
  displayCurrency?: 'local' | 'usd';
}) {
  const [pending, startTransition] = useTransition();
  const [income, setIncome] = useState(String(period.incomeTotal));
  const [rate, setRate] = useState(String(period.dollarRate));
  const [market, setMarket] = useState<{ rate: number; source: string } | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);
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

  // Orden local de las categorías/secciones (drag & drop optimista).
  const [cats, setCats] = useState<Category[]>(categories);
  const [prevCats, setPrevCats] = useState(categories);
  if (categories !== prevCats) {
    setPrevCats(categories);
    setCats(categories);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ¿En qué categoría está un id? (un id puede ser un gasto o una categoría vacía)
  function containerOf(list: Expense[], id: string): string | undefined {
    if (id.startsWith('sec:')) return id.slice(4);
    if (categories.some((c) => c.id === id)) return id;
    return list.find((e) => e.id === id)?.categoryId;
  }

  // Mientras se arrastra entre categorías, mueve el ítem de categoría (optimista).
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId.startsWith('sec:')) return; // arrastre de sección: solo en dragEnd
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

    // Reordenar secciones (categorías).
    if (activeId.startsWith('sec:')) {
      const fromCat = activeId.slice(4);
      const toCat = overId.startsWith('sec:')
        ? overId.slice(4)
        : containerOf(items, overId);
      if (!toCat || fromCat === toCat) return;
      const ids = cats.map((c) => c.id);
      const oldIndex = ids.indexOf(fromCat);
      const newIndex = ids.indexOf(toCat);
      if (oldIndex === -1 || newIndex === -1) return;
      const nextCats = arrayMove(cats, oldIndex, newIndex);
      setCats(nextCats);
      startTransition(async () => {
        const res = await reorderCategories({
          orderedIds: nextCats.map((c) => c.id),
        });
        if (!res.ok) toast.error(res.error ?? 'No se pudo reordenar');
      });
      return;
    }

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

  // Totales en vivo según lo que se está editando (ingreso y cotización).
  // parseAmount tolera coma decimal (es-UY / es-AR escriben "41,35").
  const incomeNum = income.trim() === '' ? 0 : parseAmount(income);
  const liveIncome = Number.isNaN(incomeNum) ? period.incomeTotal : incomeNum;
  const rateNum = rate.trim() === '' ? 0 : parseAmount(rate);
  const liveRate = Number.isNaN(rateNum) ? period.dollarRate : rateNum;
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
    // Si un campo quedó inválido, conserva el valor guardado para ese campo en
    // vez de abortar todo el guardado.
    const nextIncome = Number.isNaN(incomeNum) ? period.incomeTotal : incomeNum;
    const nextRate = Number.isNaN(rateNum) ? period.dollarRate : rateNum;
    if (nextIncome === period.incomeTotal && nextRate === period.dollarRate) return;
    startTransition(async () => {
      const res = await updatePeriodHeader({
        id: period.id,
        incomeTotal: nextIncome,
        dollarRate: nextRate,
      });
      if (!res.ok) toast.error(res.error ?? 'Error al guardar');
    });
  }

  // Trae la cotización del mercado (no la aplica): el usuario decide si la usa.
  function loadMarketRate() {
    setFetchingRate(true);
    fetchMarketRate(period.id)
      .then((res) => {
        if (res.ok && res.data) setMarket(res.data);
        else toast.error(res.error ?? 'No se pudo obtener la cotización');
      })
      .finally(() => setFetchingRate(false));
  }

  // Aplica la cotización del mercado al campo (y la guarda).
  function useMarketRate() {
    if (!market) return;
    setRate(String(market.rate));
    startTransition(async () => {
      const res = await updatePeriodHeader({
        id: period.id,
        incomeTotal: Number.isNaN(incomeNum) ? period.incomeTotal : incomeNum,
        dollarRate: market.rate,
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
        <CardContent className="flex flex-wrap items-start gap-x-8 gap-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="income">Ingreso total ({localCurrency})</Label>
            <Input
              id="income"
              inputMode="decimal"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              onBlur={saveHeader}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              className="w-48 tabular-nums"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="dollar-rate">Dólar del mes ({localCurrency}/USD)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="dollar-rate"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                onBlur={saveHeader}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                className="w-32 tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadMarketRate}
                disabled={fetchingRate}
              >
                <RefreshCw className={cn('size-4', fetchingRate && 'animate-spin')} />
                Traer del mercado
              </Button>
            </div>
            {market ? (
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
                <span>
                  Mercado ({market.source}):{' '}
                  <span className="text-foreground font-medium tabular-nums">
                    $ {market.rate}
                  </span>
                </span>
                {market.rate !== liveRate && (
                  <button
                    type="button"
                    onClick={useMarketRate}
                    className="text-primary font-medium hover:underline"
                  >
                    Usar esta
                  </button>
                )}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Escribe el valor o tráelo del mercado y decide cuál usar.
              </p>
            )}
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
      <SortableContext
        items={cats.map((c) => `sec:${c.id}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-4">
          {cats.map((cat) => (
            <SortableSection
              key={cat.id}
              category={cat}
              rows={grouped.get(cat.id) ?? []}
              open={openMap[cat.id] !== false}
              onOpenChange={(o) => setSection(cat.id, o)}
              rate={liveRate}
              dispCode={dispCode}
              locale={locale}
              toDisp={toDisp}
              localCurrency={localCurrency}
              goals={goals}
              otherPeriods={otherPeriods}
              onAdd={() => handleAdd(cat.id)}
              addDisabled={pending}
            />
          ))}
        </div>
      </SortableContext>
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
  otherPeriods,
}: {
  categoryId: string;
  rows: Expense[];
  rate: number;
  localCurrency: string;
  locale: string;
  goals: Goal[];
  otherPeriods: { id: string; label: string }[];
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
              otherPeriods={otherPeriods}
            />
          ))
        )}
      </SortableContext>
    </TableBody>
  );
}

/** Sección (categoría) colapsable y reordenable por su handle. */
function SortableSection({
  category,
  rows,
  open,
  onOpenChange,
  rate,
  dispCode,
  locale,
  toDisp,
  localCurrency,
  goals,
  otherPeriods,
  onAdd,
  addDisabled,
}: {
  category: Category;
  rows: Expense[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rate: number;
  dispCode: string;
  locale: string;
  toDisp: (n: number) => number;
  localCurrency: string;
  goals: Goal[];
  otherPeriods: { id: string; label: string }[];
  onAdd: () => void;
  addDisabled: boolean;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: `sec:${category.id}` });
  const catTotal = rows.reduce(
    (s, e) => s + (e.currency === 'USD' ? e.amount * rate : e.amount),
    0
  );

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        {...attributes}
        className={cn(
          'bg-card ring-border/60 overflow-hidden rounded-xl shadow-sm ring-1',
          isDragging && 'relative z-10 shadow-lg'
        )}
      >
        <div className="flex items-stretch">
          <button
            type="button"
            {...listeners}
            aria-label="Reordenar sección"
            className="text-muted-foreground/40 hover:text-muted-foreground flex shrink-0 cursor-grab touch-none items-center pl-3 active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group hover:bg-muted/40 flex flex-1 cursor-pointer items-center justify-between gap-3 py-3 pr-4 pl-2 text-left transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex size-9 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `${category.color}33`,
                    color: category.color,
                  }}
                >
                  <CategoryIcon name={category.icon} className="size-5" />
                </span>
                <span className="font-semibold">{category.name}</span>
                <Badge variant="secondary" className="rounded-full">
                  {rows.length}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <Money
                  animateOnMount
                  value={toDisp(catTotal)}
                  currency={dispCode}
                  locale={locale}
                  className="text-base font-semibold tabular-nums"
                />
                <ChevronDown className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180" />
              </div>
            </button>
          </CollapsibleTrigger>
        </div>
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
                categoryId={category.id}
                rows={rows}
                rate={rate}
                localCurrency={localCurrency}
                locale={locale}
                goals={goals}
                otherPeriods={otherPeriods}
              />
            </Table>
            <div className="px-2 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={onAdd}
                disabled={addDisabled}
              >
                <Plus className="size-4" /> Agregar gasto
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

