'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
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
import type { TodoColumn } from '@/db';
import type { TodoWithItems } from '../queries';
import {
  createColumn,
  updateColumn,
  deleteColumn,
  reorderColumns,
  createTodo,
  updateTodo,
  deleteTodo,
  moveTodo,
  addTodoItem,
  updateTodoItem,
  deleteTodoItem,
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
  todos: TodoWithItems[];
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

  const [items, setItems] = useState<TodoWithItems[]>(todos);
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
    todo: TodoWithItems | null;
    columnId: string;
  }>({ open: false, todo: null, columnId: '' });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TodoWithItems[]>();
    for (const c of cols) map.set(c.id, []);
    for (const t of items) {
      if (!map.has(t.columnId)) map.set(t.columnId, []);
      map.get(t.columnId)!.push(t);
    }
    return map;
  }, [cols, items]);

  function containerOf(list: TodoWithItems[], id: string): string | undefined {
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
  const pendingCount = totalCount - doneCount;
  const donePct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Propósitos</p>
          <h1 className="font-heading mt-1 text-[46px] leading-none font-bold tracking-tight [letter-spacing:-0.025em]">
            Todos
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
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
        <Card variant="ink">
          <CardContent className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-sm text-(--sb-mute)">Completadas</p>
              <p className="font-heading mt-1 text-[32px] leading-none font-bold tabular-nums text-white [letter-spacing:-0.025em]">
                {doneCount}
              </p>
            </div>
            <div>
              <p className="text-sm text-(--sb-mute)">Pendientes</p>
              <p className="font-heading mt-1 text-[32px] leading-none font-bold tabular-nums text-white [letter-spacing:-0.025em]">
                {pendingCount}
              </p>
            </div>
            <div>
              <p className="text-sm text-(--sb-mute)">Progreso en {year}</p>
              <p className="font-heading mt-1 flex items-center gap-2 text-[32px] leading-none font-bold tabular-nums text-(--lime) [letter-spacing:-0.025em]">
                <ListChecks className="size-6" />
                {donePct}%
              </p>
            </div>
          </CardContent>
        </Card>
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
  todos: TodoWithItems[];
  onAddTodo: () => void;
  onEditTodo: (todo: TodoWithItems) => void;
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
        'bg-secondary/40 border-border flex w-72 shrink-0 flex-col gap-3 rounded-2xl border p-3',
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
          className="ring-background size-3 shrink-0 rounded-full ring-2"
          style={{ backgroundColor: column.color }}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {column.name}
        </span>
        <Badge variant="neutral" className="shrink-0 tabular-nums">
          {todos.length}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground -mr-1 shrink-0"
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
            <p className="text-muted-foreground rounded-xl border-[1.5px] border-dashed border-[#C5CBBF] py-4 text-center text-xs">
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

function TodoCard({ todo, onEdit }: { todo: TodoWithItems; onEdit: () => void }) {
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
        'bg-card border-border group flex items-start gap-1.5 rounded-xl border p-2.5 shadow-sm transition-shadow hover:shadow-md',
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
        {(todo.dueDate || todo.items.length > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {todo.dueDate && (
              <span
                className={cn(
                  'text-muted-foreground inline-flex items-center gap-1 text-xs',
                  !done && days !== null && days < 0 && 'text-destructive',
                  !done && days !== null && days >= 0 && days <= 7 && 'text-[var(--amber)]'
                )}
              >
                <CalendarClock className="size-3.5" />
                {formatDueDate(todo.dueDate)}
              </span>
            )}
            {todo.items.length > 0 && (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums">
                <ListChecks className="size-3.5" />
                {todo.items.filter((i) => i.checked).length}/{todo.items.length}
              </span>
            )}
          </div>
        )}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100"
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
  todo: TodoWithItems | null;
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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
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

          {isEdit ? (
            <div className="grid gap-1.5">
              <Label>Lista de verificación (opcional)</Label>
              <TodoItemsEditor todoId={todo.id} initialItems={todo.items} />
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Vas a poder agregarle una lista de verificación (ej. cuotas, pasos) una
              vez que la crees.
            </p>
          )}
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

interface ItemRow {
  id: string;
  text: string;
  checked: boolean;
}

/**
 * Checklist dentro de una tarea (ej. "Noviembre 500", "Diciembre 500 + 2000
 * Aguinaldo"…). Cada acción pega al servidor al toque, sin esperar al botón
 * "Guardar" del diálogo, para que tildar un ítem se sienta inmediato.
 */
function TodoItemsEditor({
  todoId,
  initialItems,
}: {
  todoId: string;
  initialItems: { id: string; text: string; checked: boolean }[];
}) {
  const [items, setItems] = useState<ItemRow[]>(
    initialItems.map((i) => ({ id: i.id, text: i.text, checked: i.checked }))
  );
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  // Último texto confirmado por el servidor para cada ítem, para poder
  // revertir si el usuario deja el campo vacío al salir.
  const savedText = useRef(new Map(initialItems.map((i) => [i.id, i.text])));

  async function handleAdd() {
    const text = newText.trim();
    if (!text || adding) return;
    setAdding(true);
    const res = await addTodoItem({ todoId, text });
    setAdding(false);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? 'No se pudo agregar el ítem');
      return;
    }
    savedText.current.set(res.data.id, text);
    setItems((prev) => [...prev, { id: res.data!.id, text, checked: false }]);
    setNewText('');
  }

  async function handleToggle(item: ItemRow) {
    const checked = !item.checked;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked } : i)));
    const res = await updateTodoItem({ id: item.id, checked });
    if (!res.ok) {
      toast.error(res.error ?? 'No se pudo actualizar');
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: !checked } : i)));
    }
  }

  function handleTextChange(id: string, text: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, text } : i)));
  }

  async function handleTextBlur(item: ItemRow) {
    const trimmed = item.text.trim();
    const last = savedText.current.get(item.id) ?? '';
    if (!trimmed) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, text: last } : i)));
      return;
    }
    if (trimmed === last) return;
    const res = await updateTodoItem({ id: item.id, text: trimmed });
    if (!res.ok) {
      toast.error(res.error ?? 'No se pudo guardar');
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, text: last } : i)));
      return;
    }
    savedText.current.set(item.id, trimmed);
  }

  async function handleDelete(item: ItemRow) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const res = await deleteTodoItem({ id: item.id });
    if (!res.ok) {
      toast.error(res.error ?? 'No se pudo eliminar');
      setItems((prev) => [...prev, item]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border p-1.5">
          {items.map((item) => (
            <div key={item.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1">
              <Checkbox checked={item.checked} onCheckedChange={() => handleToggle(item)} />
              <input
                value={item.text}
                onChange={(e) => handleTextChange(item.id, e.target.value)}
                onBlur={() => handleTextBlur(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className={cn(
                  'min-w-0 flex-1 bg-transparent text-sm outline-none',
                  item.checked && 'text-muted-foreground line-through'
                )}
              />
              <button
                type="button"
                onClick={() => handleDelete(item)}
                aria-label="Eliminar ítem"
                className="text-muted-foreground/50 hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={newText}
          placeholder="Agregar ítem…"
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleAdd}
          disabled={adding || !newText.trim()}
          aria-label="Agregar ítem"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
