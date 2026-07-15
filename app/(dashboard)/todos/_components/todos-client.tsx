'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  GripVertical,
  CalendarClock,
  ListChecks,
} from 'lucide-react';
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
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { Todo, TodoColumn } from '@/db';
import {
  createColumn,
  updateColumn,
  deleteColumn,
  reorderColumns,
  createTodo,
  updateTodo,
  deleteTodo,
  moveTodo,
} from '../actions';

function daysLeft(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function formatDueDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' });
}

export function TodosClient({
  columns,
  todos,
  years,
  year,
}: {
  columns: TodoColumn[];
  todos: Todo[];
  years: number[];
  year: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Orden local de columnas y tareas (drag & drop optimista). Se resincroniza
  // en el render cuando el servidor envía nuevos datos, sin usar un efecto.
  const [cols, setCols] = useState<TodoColumn[]>(columns);
  const [prevCols, setPrevCols] = useState(columns);
  if (columns !== prevCols) {
    setPrevCols(columns);
    setCols(columns);
  }

  const [items, setItems] = useState<Todo[]>(todos);
  const [prevItems, setPrevItems] = useState(todos);
  if (todos !== prevItems) {
    setPrevItems(todos);
    setItems(todos);
  }

  const [columnDialog, setColumnDialog] = useState<{
    open: boolean;
    column: TodoColumn | null;
  }>({ open: false, column: null });

  const [todoDialog, setTodoDialog] = useState<{
    open: boolean;
    todo: Todo | null;
    columnId: string;
  }>({ open: false, todo: null, columnId: '' });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const c of cols) map.set(c.id, []);
    for (const t of items) {
      if (!map.has(t.columnId)) map.set(t.columnId, []);
      map.get(t.columnId)!.push(t);
    }
    return map;
  }, [cols, items]);

  function containerOf(list: Todo[], id: string): string | undefined {
    if (id.startsWith('col:')) return id.slice(4);
    if (cols.some((c) => c.id === id)) return id;
    return list.find((t) => t.id === id)?.columnId;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId.startsWith('col:')) return;
    setItems((prev) => {
      const activeItem = prev.find((t) => t.id === activeId);
      if (!activeItem) return prev;
      const overContainer = containerOf(prev, overId);
      if (!overContainer || activeItem.columnId === overContainer) return prev;

      const without = prev.filter((t) => t.id !== activeId);
      const moved = { ...activeItem, columnId: overContainer };
      const overIsContainer = cols.some((c) => c.id === overId);
      if (!overIsContainer) {
        const idx = without.findIndex((t) => t.id === overId);
        if (idx === -1) return [...without, moved];
        return [...without.slice(0, idx), moved, ...without.slice(idx)];
      }
      let lastIdx = -1;
      without.forEach((t, i) => {
        if (t.columnId === overContainer) lastIdx = i;
      });
      return [...without.slice(0, lastIdx + 1), moved, ...without.slice(lastIdx + 1)];
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Reordenar columnas.
    if (activeId.startsWith('col:')) {
      const fromCol = activeId.slice(4);
      const toCol = overId.startsWith('col:') ? overId.slice(4) : containerOf(items, overId);
      if (!toCol || fromCol === toCol) return;
      const ids = cols.map((c) => c.id);
      const oldIndex = ids.indexOf(fromCol);
      const newIndex = ids.indexOf(toCol);
      if (oldIndex === -1 || newIndex === -1) return;
      const nextCols = arrayMove(cols, oldIndex, newIndex);
      setCols(nextCols);
      startTransition(async () => {
        const res = await reorderColumns({ orderedIds: nextCols.map((c) => c.id) });
        if (!res.ok) toast.error(res.error ?? 'No se pudo reordenar');
      });
      return;
    }

    const activeItem = items.find((t) => t.id === activeId);
    if (!activeItem) return;
    const container = activeItem.columnId; // ya refleja el destino tras dragOver

    let next = items;
    const overItem = items.find((t) => t.id === overId);
    if (overItem && overItem.columnId === container && overId !== activeId) {
      const ids = items.filter((t) => t.columnId === container).map((t) => t.id);
      const oldIndex = ids.indexOf(activeId);
      const newIndex = ids.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(ids, oldIndex, newIndex);
        const byId = new Map(items.map((t) => [t.id, t]));
        const queue = reordered.map((id) => byId.get(id)!);
        let qi = 0;
        next = items.map((t) => (t.columnId === container ? queue[qi++] : t));
        setItems(next);
      }
    }

    const orderedIds = next.filter((t) => t.columnId === container).map((t) => t.id);
    startTransition(async () => {
      const res = await moveTodo({ id: activeId, columnId: container, orderedIds });
      if (!res.ok) toast.error(res.error ?? 'No se pudo mover');
    });
  }

  const totalCount = items.length;
  const doneCount = items.filter((t) => t.completedAt).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Todos</h1>
          <p className="text-muted-foreground mt-1 text-base">
            Propósitos y tareas del año. Arrastra las tarjetas para llevar el
            seguimiento y revisa al cerrar el año qué lograste.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(y) => router.push(`/todos?year=${y}`)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setColumnDialog({ open: true, column: null })}>
            <Plus /> Columna
          </Button>
        </div>
      </div>

      {totalCount > 0 && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <ListChecks className="size-4" />
          {doneCount} de {totalCount} tarea(s) completadas en {year}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        autoScroll={false}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={cols.map((c) => `col:${c.id}`)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex items-start gap-4 overflow-x-auto pb-4">
            {cols.map((col) => (
              <ColumnView
                key={col.id}
                column={col}
                todos={grouped.get(col.id) ?? []}
                onAddTodo={() => setTodoDialog({ open: true, todo: null, columnId: col.id })}
                onEditTodo={(t) => setTodoDialog({ open: true, todo: t, columnId: t.columnId })}
                onEditColumn={() => setColumnDialog({ open: true, column: col })}
                onDeleteColumn={async () => {
                  const res = await deleteColumn(col.id);
                  if (!res.ok) toast.error(res.error ?? 'No se pudo eliminar');
                  else toast.success('Columna eliminada');
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <ColumnDialog
        key={`col-${columnDialog.column?.id ?? 'new'}`}
        open={columnDialog.open}
        column={columnDialog.column}
        onOpenChange={(o) => setColumnDialog((d) => ({ ...d, open: o }))}
      />

      <TodoDialog
        key={`todo-${todoDialog.todo?.id ?? 'new'}`}
        open={todoDialog.open}
        todo={todoDialog.todo}
        columnId={todoDialog.columnId}
        year={year}
        onOpenChange={(o) => setTodoDialog((d) => ({ ...d, open: o }))}
      />
    </div>
  );
}

function ColumnView({
  column,
  todos,
  onAddTodo,
  onEditTodo,
  onEditColumn,
  onDeleteColumn,
}: {
  column: TodoColumn;
  todos: Todo[];
  onAddTodo: () => void;
  onEditTodo: (todo: Todo) => void;
  onEditColumn: () => void;
  onDeleteColumn: () => void;
}) {
  const confirm = useConfirm();
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: `col:${column.id}` });
  const { setNodeRef: setBodyRef, isOver } = useDroppable({ id: column.id });

  async function handleDeleteColumn() {
    const ok = await confirm({
      title: 'Eliminar columna',
      description: `Se eliminará la columna "${column.name}".`,
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    onDeleteColumn();
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      className={cn(
        'bg-muted/40 ring-border/60 flex w-72 shrink-0 flex-col gap-3 rounded-xl p-3 ring-1',
        isDragging && 'relative z-10 shadow-lg'
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...listeners}
          aria-label="Reordenar columna"
          className="text-muted-foreground/40 hover:text-muted-foreground -ml-1 flex shrink-0 cursor-grab touch-none items-center active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: column.color }}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {column.name}
        </span>
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {todos.length}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground -mr-1 size-7 shrink-0"
              aria-label="Acciones de la columna"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEditColumn}>
              <Pencil className="size-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleDeleteColumn}>
              <Trash2 className="size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        ref={setBodyRef}
        className={cn(
          'flex min-h-16 flex-col gap-2 rounded-lg transition-colors',
          isOver && 'bg-primary/5'
        )}
      >
        <SortableContext
          items={todos.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {todos.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-xs">
              Sin tareas. Arrastra una aquí.
            </p>
          ) : (
            todos.map((t) => (
              <TodoCard key={t.id} todo={t} onEdit={() => onEditTodo(t)} />
            ))
          )}
        </SortableContext>
      </div>

      <Button variant="ghost" size="sm" className="justify-start" onClick={onAddTodo}>
        <Plus className="size-4" /> Agregar tarea
      </Button>
    </div>
  );
}

function TodoCard({ todo, onEdit }: { todo: Todo; onEdit: () => void }) {
  const confirm = useConfirm();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id });

  const done = Boolean(todo.completedAt);
  const days = todo.dueDate ? daysLeft(todo.dueDate) : null;

  async function handleDelete() {
    const ok = await confirm({
      title: 'Eliminar tarea',
      description: `Se eliminará "${todo.title}".`,
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    const res = await deleteTodo(todo.id);
    if (!res.ok) toast.error(res.error ?? 'No se pudo eliminar');
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'bg-card ring-border/60 group flex items-start gap-1.5 rounded-lg p-2.5 ring-1',
        isDragging && 'relative z-10 shadow-lg'
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Arrastrar para reordenar"
        className="text-muted-foreground/30 hover:text-muted-foreground mt-0.5 shrink-0 cursor-grab touch-none active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>

      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className={cn('text-sm font-medium', done && 'text-muted-foreground line-through')}>
          {todo.title}
        </p>
        {todo.note && (
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{todo.note}</p>
        )}
        {todo.dueDate && (
          <span
            className={cn(
              'text-muted-foreground mt-1.5 inline-flex items-center gap-1 text-xs',
              !done && days !== null && days < 0 && 'text-destructive',
              !done && days !== null && days >= 0 && days <= 7 && 'text-amber-600 dark:text-amber-400'
            )}
          >
            <CalendarClock className="size-3.5" />
            {formatDueDate(todo.dueDate)}
          </span>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-6 shrink-0 opacity-0 group-hover:opacity-100"
            aria-label="Acciones de la tarea"
          >
            <MoreVertical className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="size-4" /> Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={handleDelete}>
            <Trash2 className="size-4" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ColumnDialog({
  open,
  column,
  onOpenChange,
}: {
  open: boolean;
  column: TodoColumn | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(column?.name ?? '');
  const [color, setColor] = useState(column?.color ?? '#64748b');
  const [isDone, setIsDone] = useState(column?.isDone ?? false);

  const isEdit = column !== null;

  function submit() {
    if (!name.trim()) {
      toast.error('Ponle un nombre a la columna');
      return;
    }
    startTransition(async () => {
      const res = isEdit
        ? await updateColumn({ id: column.id, name: name.trim(), color, isDone })
        : await createColumn({ name: name.trim(), color, isDone });
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo guardar');
        return;
      }
      toast.success(isEdit ? 'Columna actualizada' : 'Columna creada');
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar columna' : 'Nueva columna'}</DialogTitle>
          <DialogDescription>
            Las columnas representan las etapas de tu tablero (ej. &quot;Por hacer&quot;).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="col-name">Nombre</Label>
              <Input
                id="col-name"
                value={name}
                placeholder="Ej. En progreso"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="col-color">Color</Label>
              <Input
                id="col-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 p-1"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5">
            <Checkbox
              checked={isDone}
              onCheckedChange={(v) => setIsDone(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              Marcar como &quot;hecho&quot;: las tareas que caigan aquí cuentan como
              logradas en el resumen del año.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {isEdit ? 'Guardar' : 'Crear columna'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TodoDialog({
  open,
  todo,
  columnId,
  year,
  onOpenChange,
}: {
  open: boolean;
  todo: Todo | null;
  columnId: string;
  year: number;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(todo?.title ?? '');
  const [note, setNote] = useState(todo?.note ?? '');
  const [dueDate, setDueDate] = useState(todo?.dueDate ?? '');

  const isEdit = todo !== null;

  function submit() {
    if (!title.trim()) {
      toast.error('Ponle un título a la tarea');
      return;
    }
    startTransition(async () => {
      const res = isEdit
        ? await updateTodo({
            id: todo.id,
            title: title.trim(),
            note: note.trim() || null,
            dueDate: dueDate || null,
          })
        : await createTodo({
            columnId,
            year,
            title: title.trim(),
            note: note.trim() || null,
            dueDate: dueDate || null,
          });
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo guardar');
        return;
      }
      toast.success(isEdit ? 'Tarea actualizada' : 'Tarea creada');
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Todos ${year}` : `Se agregará al tablero de ${year}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="todo-title">Título</Label>
            <Input
              id="todo-title"
              value={title}
              placeholder="Ej. Aprender a tocar guitarra"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="todo-note">Nota (opcional)</Label>
            <Textarea
              id="todo-note"
              value={note}
              placeholder="Detalles, pasos, por qué es importante…"
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              className="resize-none"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Fecha límite (opcional)</Label>
            <DatePicker
              value={dueDate}
              onChange={(iso) => setDueDate(iso ?? '')}
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {isEdit ? 'Guardar' : 'Crear tarea'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
