'use client';

import { useMemo, useState, useTransition } from 'react';
import { CalendarDays, GripVertical, Link2, CircleCheck, Pencil } from 'lucide-react';
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
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { daysBetween } from '@/lib/dates';
import type { Trip, TripExpense } from '@/db';
import { moveTripExpenseDay, setTripDayTitle } from '../../actions';

const NONE = 'none';

export function formatDayHeader(iso: string, locale: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

/** A qué "contenedor" (día ISO, o "sin día") pertenece un gasto del viaje. */
function containerKeyOf(e: TripExpense, startDate: string, endDate: string): string {
  if (!e.date) return NONE;
  if (e.date < startDate || e.date > endDate) return NONE;
  return e.date;
}

export function TripItinerary({
  trip,
  expenses,
  locale,
  dayTitles = {},
}: {
  trip: Trip;
  expenses: TripExpense[];
  locale: string;
  dayTitles?: Record<string, string>;
}) {
  const [, startTransition] = useTransition();

  const days = useMemo(
    () => (trip.startDate && trip.endDate ? daysBetween(trip.startDate, trip.endDate) : []),
    [trip.startDate, trip.endDate]
  );
  const containers = useMemo(() => [...days, NONE], [days]);

  // Orden local optimista (drag & drop). Se resincroniza en el render cuando
  // el servidor envía nuevos datos, sin usar un efecto.
  const [items, setItems] = useState<TripExpense[]>(expenses);
  const [prevExpenses, setPrevExpenses] = useState(expenses);
  if (expenses !== prevExpenses) {
    setPrevExpenses(expenses);
    setItems(expenses);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const keyOf = (e: TripExpense) => containerKeyOf(e, trip.startDate ?? '', trip.endDate ?? '');

  const grouped = useMemo(() => {
    const map = new Map<string, TripExpense[]>();
    for (const c of containers) map.set(c, []);
    for (const e of items) {
      const key = keyOf(e);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containers, items, trip.startDate, trip.endDate]);

  function containerOf(list: TripExpense[], id: string): string | undefined {
    if (containers.includes(id)) return id;
    const found = list.find((e) => e.id === id);
    return found ? keyOf(found) : undefined;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setItems((prev) => {
      const activeItem = prev.find((e) => e.id === activeId);
      if (!activeItem) return prev;
      const overContainer = containerOf(prev, overId);
      if (!overContainer || keyOf(activeItem) === overContainer) return prev;

      const without = prev.filter((e) => e.id !== activeId);
      const moved: TripExpense = { ...activeItem, date: overContainer === NONE ? null : overContainer };
      const overIsContainer = containers.includes(overId);
      if (!overIsContainer) {
        const idx = without.findIndex((e) => e.id === overId);
        if (idx === -1) return [...without, moved];
        return [...without.slice(0, idx), moved, ...without.slice(idx)];
      }
      let lastIdx = -1;
      without.forEach((e, i) => {
        if (keyOf(e) === overContainer) lastIdx = i;
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
    const container = keyOf(activeItem); // ya refleja el destino tras dragOver

    let next = items;
    const overItem = items.find((e) => e.id === overId);
    if (overItem && keyOf(overItem) === container && overId !== activeId) {
      const ids = items.filter((e) => keyOf(e) === container).map((e) => e.id);
      const oldIndex = ids.indexOf(activeId);
      const newIndex = ids.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(ids, oldIndex, newIndex);
        const byId = new Map(items.map((e) => [e.id, e]));
        const queue = reordered.map((id) => byId.get(id)!);
        let qi = 0;
        next = items.map((e) => (keyOf(e) === container ? queue[qi++] : e));
        setItems(next);
      }
    }

    const orderedIds = next.filter((e) => keyOf(e) === container).map((e) => e.id);
    startTransition(async () => {
      const res = await moveTripExpenseDay({
        id: activeId,
        tripId: trip.id,
        date: container === NONE ? null : container,
        orderedIds,
      });
      if (!res.ok) toast.error(res.error ?? 'No se pudo mover');
    });
  }

  if (days.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        Define fecha de inicio y fin del viaje para organizarlo por días.
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      autoScroll={false}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-start gap-3 overflow-x-auto pb-2">
        {days.map((day, i) => (
          <DayColumn
            key={day}
            id={day}
            title={`Día ${i + 1}`}
            subtitle={formatDayHeader(day, locale)}
            items={grouped.get(day) ?? []}
            locale={locale}
            tripId={trip.id}
            date={day}
            dayTheme={dayTitles[day] ?? null}
          />
        ))}
        <DayColumn
          id={NONE}
          title="Sin día asignado"
          items={grouped.get(NONE) ?? []}
          locale={locale}
        />
      </div>
    </DndContext>
  );
}

function DayColumn({
  id,
  title,
  subtitle,
  items,
  locale,
  tripId,
  date,
  dayTheme,
}: {
  id: string;
  title: string;
  subtitle?: string;
  items: TripExpense[];
  locale: string;
  tripId?: string;
  date?: string;
  dayTheme?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="bg-muted/40 ring-border/60 flex w-64 shrink-0 flex-col gap-2 rounded-xl p-3 ring-1">
      <div className="flex items-center gap-2">
        <CalendarDays className="text-muted-foreground size-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          {subtitle && <p className="text-muted-foreground text-xs capitalize">{subtitle}</p>}
        </div>
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {items.length}
        </Badge>
      </div>
      {tripId && date && <DayThemeEditor tripId={tripId} date={date} theme={dayTheme ?? null} />}

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-16 flex-col gap-2 rounded-lg transition-colors',
          isOver && 'bg-primary/5'
        )}
      >
        <SortableContext items={items.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-xs">
              Arrastra un gasto aquí.
            </p>
          ) : (
            items.map((e) => (
              <ItineraryCard key={e.id} expense={e} locale={locale} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function DayThemeEditor({
  tripId,
  date,
  theme,
}: {
  tripId: string;
  date: string;
  theme: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(theme ?? '');
  const [, startTransition] = useTransition();

  function save() {
    setEditing(false);
    const next = value.trim();
    if (next === (theme ?? '')) return;
    startTransition(async () => {
      const res = await setTripDayTitle({ tripId, date, title: next || null });
      if (!res.ok) toast.error(res.error ?? 'No se pudo guardar el tema del día');
    });
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={value}
        placeholder="Tema del día (opcional)"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') {
            setValue(theme ?? '');
            setEditing(false);
          }
        }}
        className="h-7 text-xs"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group/theme text-muted-foreground hover:text-foreground -mt-1 flex items-center gap-1 truncate text-left text-xs"
    >
      {theme ? (
        <span className="truncate italic">{theme}</span>
      ) : (
        <span>+ agregar tema del día</span>
      )}
      <Pencil className="size-3 shrink-0 opacity-0 group-hover/theme:opacity-100" />
    </button>
  );
}

function ItineraryCard({
  expense,
  locale,
}: {
  expense: TripExpense;
  locale: string;
}) {
  const linked = expense.expenseId !== null;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: expense.id,
    disabled: linked,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'bg-card ring-border/60 group flex items-start gap-1.5 rounded-lg p-2.5 ring-1',
        isDragging && 'relative z-10 shadow-lg'
      )}
    >
      {linked ? (
        <span
          className="text-muted-foreground/40 mt-0.5 shrink-0"
          title="Viene de un gasto vinculado; edítalo desde el mes"
        >
          <Link2 className="size-4" />
        </span>
      ) : (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Arrastrar para mover de día"
          className="text-muted-foreground/30 hover:text-muted-foreground mt-0.5 shrink-0 cursor-grab touch-none active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', expense.paid && 'text-muted-foreground line-through')}>
          {expense.time && <span className="text-muted-foreground font-normal">{expense.time} · </span>}
          {expense.concept}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <Badge variant="outline" className="rounded-full text-[10px]">
            {expense.category}
          </Badge>
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatMoney(expense.amount, expense.currency, locale)}
          </span>
          {expense.paid && (
            <CircleCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>
      </div>
    </div>
  );
}
