'use client';

import { useState, useTransition } from 'react';
import {
  Trash2,
  MoreVertical,
  Bookmark,
  Clock,
  CircleCheck,
  CircleAlert,
  GripVertical,
  Target,
  CalendarClock,
  Repeat,
  CreditCard,
  PiggyBank,
  Plane,
  type LucideIcon,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/confirm-provider';
import { BrandLogo } from '@/components/brand-logo';
import { DatePicker } from '@/components/date-picker';
import { ConvertToInstallmentsDialog } from './convert-to-installments-dialog';
import { Money } from '@/components/money';
import { toUsd } from '@/lib/money';
import type { Expense, Goal, SavingsAccount } from '@/db';
import {
  updateExpense,
  deleteExpense,
  saveExpenseAsTemplate,
  setExpenseGoal,
  setExpenseSavings,
  setExpenseTrip,
  moveExpenseToPeriod,
  deletePurchase,
} from '../actions';

const STATUS_STYLES: Record<string, string> = {
  pendiente: 'text-amber-700 dark:text-amber-400',
  pagado: 'text-emerald-700 dark:text-emerald-400',
  vencido: 'text-red-700 dark:text-red-400',
};

const STATUS_ICONS: Record<string, LucideIcon> = {
  pendiente: Clock,
  pagado: CircleCheck,
  vencido: CircleAlert,
};

export function ExpenseRow({
  expense,
  order,
  rate,
  localCurrency = 'UYU',
  locale = 'es-UY',
  goals = [],
  savingsAccounts = [],
  trips = [],
  otherPeriods = [],
}: {
  expense: Expense;
  order: number;
  rate: number;
  localCurrency?: string;
  locale?: string;
  goals?: Goal[];
  savingsAccounts?: SavingsAccount[];
  trips?: { id: string; name: string; icon: string; color: string }[];
  otherPeriods?: { id: string; label: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: expense.id });
  const [concept, setConcept] = useState(expense.concept);
  const [amount, setAmount] = useState(expense.amount ? String(expense.amount) : '');
  const [convertOpen, setConvertOpen] = useState(false);

  function save(fields: Parameters<typeof updateExpense>[0]) {
    startTransition(async () => {
      const res = await updateExpense(fields);
      if (!res.ok) toast.error(res.error ?? 'Error al guardar');
    });
  }

  function saveConcept() {
    const trimmed = concept.trim();
    if (trimmed && trimmed !== expense.concept) {
      save({ id: expense.id, concept: trimmed });
    } else if (!trimmed) {
      setConcept(expense.concept);
    }
  }

  function saveAmount() {
    const value = amount === '' ? 0 : Number(amount);
    if (Number.isNaN(value)) {
      setAmount(expense.amount ? String(expense.amount) : '');
      return;
    }
    if (value !== expense.amount) save({ id: expense.id, amount: value });
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Eliminar gasto',
      description: `Se eliminará "${expense.concept}". Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteExpense(expense.id);
      if (!res.ok) toast.error(res.error ?? 'Error al eliminar');
    });
  }

  function handleSaveTemplate() {
    startTransition(async () => {
      const res = await saveExpenseAsTemplate(expense.id);
      if (!res.ok) toast.error(res.error ?? 'Error');
      else toast.success('Guardado como plantilla');
    });
  }

  function linkGoal(goalId: string | null) {
    if (goalId === (expense.goalId ?? null)) return;
    startTransition(async () => {
      const res = await setExpenseGoal({ id: expense.id, goalId });
      if (!res.ok) toast.error(res.error ?? 'Error al vincular');
      else toast.success(goalId ? 'Gasto vinculado a la meta' : 'Gasto desvinculado');
    });
  }

  function linkSavings(savingsAccountId: string | null) {
    if (savingsAccountId === (expense.savingsAccountId ?? null)) return;
    startTransition(async () => {
      const res = await setExpenseSavings({ id: expense.id, savingsAccountId });
      if (!res.ok) toast.error(res.error ?? 'Error al vincular');
      else
        toast.success(
          savingsAccountId ? 'Gasto vinculado al ahorro' : 'Gasto desvinculado'
        );
    });
  }

  function linkTrip(tripId: string | null) {
    if (tripId === (expense.tripId ?? null)) return;
    startTransition(async () => {
      const res = await setExpenseTrip({ id: expense.id, tripId });
      if (!res.ok) toast.error(res.error ?? 'Error al vincular');
      else toast.success(tripId ? 'Gasto vinculado al viaje' : 'Gasto desvinculado');
    });
  }

  async function handleDeletePurchase() {
    if (!expense.purchaseId) return;
    const ok = await confirm({
      title: 'Eliminar compra en cuotas',
      description: `Se eliminarán TODAS las cuotas de "${expense.concept.replace(/\s*\(cuota.*$/, '')}" en todos los meses. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar todo',
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deletePurchase(expense.purchaseId!);
      if (!res.ok) toast.error(res.error ?? 'Error al eliminar la compra');
      else toast.success('Compra en cuotas eliminada');
    });
  }

  function toggleRecurring() {
    const next = !expense.recurring;
    startTransition(async () => {
      const res = await updateExpense({ id: expense.id, recurring: next });
      if (!res.ok) toast.error(res.error ?? 'Error al guardar');
      else
        toast.success(
          next
            ? 'Se agregará automáticamente cada mes'
            : 'Ya no es recurrente'
        );
    });
  }

  function moveToPeriod(toPeriodId: string, label: string) {
    startTransition(async () => {
      // Al posponer/mover se reinicia a "pendiente" (aún no se pagó en el nuevo mes).
      const res = await moveExpenseToPeriod({
        id: expense.id,
        toPeriodId,
        resetStatus: true,
      });
      if (!res.ok) toast.error(res.error ?? 'No se pudo mover el gasto');
      else toast.success(`"${expense.concept}" movido a ${label}`);
    });
  }

  const usd = toUsd({ amount: amount === '' ? 0 : Number(amount), currency: expense.currency }, rate);
  const StatusIcon = STATUS_ICONS[expense.status];
  const linkedGoal = expense.goalId
    ? goals.find((g) => g.id === expense.goalId) ?? null
    : null;
  const linkedSavings = expense.savingsAccountId
    ? savingsAccounts.find((a) => a.id === expense.savingsAccountId) ?? null
    : null;
  const linkedTrip = expense.tripId
    ? trips.find((t) => t.id === expense.tripId) ?? null
    : null;

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        pending && 'opacity-60',
        isDragging && 'bg-card relative z-10 shadow-lg'
      )}
    >
      <TableCell className="w-12">
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Arrastrar para reordenar"
            className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab touch-none active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
          <span className="text-muted-foreground text-xs tabular-nums">
            {order}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <BrandLogo concept={concept} className="size-4 shrink-0" />
          <Input
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            onBlur={saveConcept}
            className="h-8 min-w-0 flex-1 border-transparent bg-transparent px-2 hover:border-input focus-visible:border-input"
          />
          {expense.recurring && (
            <span
              title="Se agrega cada mes automáticamente"
              className="text-muted-foreground shrink-0"
            >
              <Repeat className="size-3.5" aria-label="Gasto recurrente" />
            </span>
          )}
          {expense.installmentNumber && expense.installmentsCount && (
            <span
              title="Compra en cuotas"
              className="text-muted-foreground bg-muted flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums"
            >
              <CreditCard className="size-3" />
              {expense.installmentNumber}/{expense.installmentsCount}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="w-32">
        <Input
          inputMode="decimal"
          value={amount}
          placeholder="0"
          onChange={(e) => setAmount(e.target.value)}
          onBlur={saveAmount}
          className="h-8 border-transparent bg-transparent px-2 text-right tabular-nums hover:border-input focus-visible:border-input"
        />
      </TableCell>
      <TableCell className="w-20">
        <Select
          value={expense.currency}
          onValueChange={(v) => save({ id: expense.id, currency: v })}
        >
          <SelectTrigger size="sm" className="h-8 w-full border-transparent bg-transparent px-2 hover:border-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={localCurrency}>{localCurrency}</SelectItem>
            {localCurrency !== 'USD' && <SelectItem value="USD">USD</SelectItem>}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-muted-foreground w-28 pr-4 text-right text-sm tabular-nums">
        {usd ? <Money value={usd} currency="USD" locale={locale} /> : '—'}
      </TableCell>
      <TableCell className="w-32">
        <Select
          value={expense.status}
          onValueChange={(v) =>
            save({ id: expense.id, status: v as 'pendiente' | 'pagado' | 'vencido' })
          }
        >
          <SelectTrigger
            size="sm"
            className={cn(
              'h-8 w-full border-transparent bg-transparent px-2 font-medium hover:border-input',
              STATUS_STYLES[expense.status]
            )}
          >
            <StatusIcon className="size-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="pagado">Pagado</SelectItem>
            <SelectItem value="vencido">Vencido</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-36">
        <DatePicker
          value={expense.dueDate}
          onChange={(iso) => save({ id: expense.id, dueDate: iso })}
          placeholder="—"
          className="h-8 w-full border-transparent bg-transparent px-2 text-sm hover:border-input"
        />
      </TableCell>
      <TableCell className="w-44 px-4">
        {linkedGoal || linkedSavings || linkedTrip ? (
          <div className="flex flex-wrap items-center gap-1">
            {linkedGoal && (
              <span
                title={`Este gasto aporta a la meta: ${linkedGoal.title}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${linkedGoal.color}1a`,
                  color: linkedGoal.color,
                }}
              >
                <Target className="size-3 shrink-0" />
                <span className="truncate">{linkedGoal.title}</span>
              </span>
            )}
            {linkedSavings && (
              <span
                title={`Este gasto aporta al ahorro: ${linkedSavings.name}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${linkedSavings.color}1a`,
                  color: linkedSavings.color,
                }}
              >
                <PiggyBank className="size-3 shrink-0" />
                <span className="truncate">{linkedSavings.name}</span>
              </span>
            )}
            {linkedTrip && (
              <span
                title={`Este gasto pertenece al viaje: ${linkedTrip.name}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${linkedTrip.color}1a`,
                  color: linkedTrip.color,
                }}
              >
                <Plane className="size-3 shrink-0" />
                <span className="truncate">{linkedTrip.name}</span>
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground/50 text-sm">—</span>
        )}
      </TableCell>
      <TableCell className="w-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground size-8"
              aria-label="Acciones del gasto"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Target className="size-4" />
                {linkedGoal ? 'Meta vinculada' : 'Vincular a meta'}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {goals.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No tienes metas activas
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuRadioGroup
                    value={expense.goalId ?? ''}
                    onValueChange={(v) => linkGoal(v || null)}
                  >
                    <DropdownMenuRadioItem value="">Ninguna</DropdownMenuRadioItem>
                    {goals.map((g) => (
                      <DropdownMenuRadioItem key={g.id} value={g.id}>
                        {g.title}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <PiggyBank className="size-4" />
                {linkedSavings ? 'Ahorro vinculado' : 'Aportar a ahorro'}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {savingsAccounts.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No tienes apartados de ahorro
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuRadioGroup
                    value={expense.savingsAccountId ?? ''}
                    onValueChange={(v) => linkSavings(v || null)}
                  >
                    <DropdownMenuRadioItem value="">Ninguno</DropdownMenuRadioItem>
                    {savingsAccounts.map((a) => (
                      <DropdownMenuRadioItem key={a.id} value={a.id}>
                        {a.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Plane className="size-4" />
                {linkedTrip ? 'Viaje vinculado' : 'Vincular a viaje'}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {trips.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No tienes viajes creados
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuRadioGroup
                    value={expense.tripId ?? ''}
                    onValueChange={(v) => linkTrip(v || null)}
                  >
                    <DropdownMenuRadioItem value="">Ninguno</DropdownMenuRadioItem>
                    {trips.map((t) => (
                      <DropdownMenuRadioItem key={t.id} value={t.id}>
                        {t.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CalendarClock className="size-4" />
                Mover a mes
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {otherPeriods.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No hay otros meses
                  </DropdownMenuItem>
                ) : (
                  otherPeriods.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => moveToPeriod(p.id, p.label)}
                    >
                      {p.label}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={toggleRecurring}>
              <Repeat className="size-4" />
              {expense.recurring ? 'Quitar de recurrentes' : 'Marcar como recurrente'}
            </DropdownMenuItem>
            {!expense.purchaseId && (
              <DropdownMenuItem onClick={() => setConvertOpen(true)}>
                <CreditCard className="size-4" /> Convertir en cuotas…
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleSaveTemplate}>
              <Bookmark className="size-4" /> Guardar como plantilla
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {expense.purchaseId && (
              <DropdownMenuItem variant="destructive" onClick={handleDeletePurchase}>
                <CreditCard className="size-4" /> Eliminar compra (todas las cuotas)
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-4" /> {expense.purchaseId ? 'Eliminar esta cuota' : 'Eliminar'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {!expense.purchaseId && (
          <ConvertToInstallmentsDialog
            open={convertOpen}
            onOpenChange={setConvertOpen}
            expenseId={expense.id}
            concept={expense.concept}
            amount={amount === '' ? 0 : Number(amount)}
            currency={expense.currency}
            locale={locale}
          />
        )}
      </TableCell>
    </TableRow>
  );
}
