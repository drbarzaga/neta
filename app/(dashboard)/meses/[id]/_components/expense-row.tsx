'use client';

import { useState, useTransition } from 'react';
import {
  Trash2,
  MoreVertical,
  Bookmark,
  Clock,
  CircleCheck,
  CircleAlert,
  type LucideIcon,
} from 'lucide-react';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/confirm-provider';
import { Money } from '@/components/money';
import { toUsd } from '@/lib/money';
import type { Expense } from '@/db';
import { updateExpense, deleteExpense, saveExpenseAsTemplate } from '../actions';

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
}: {
  expense: Expense;
  order: number;
  rate: number;
  localCurrency?: string;
  locale?: string;
}) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const [concept, setConcept] = useState(expense.concept);
  const [amount, setAmount] = useState(expense.amount ? String(expense.amount) : '');

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

  const usd = toUsd({ amount: amount === '' ? 0 : Number(amount), currency: expense.currency }, rate);
  const StatusIcon = STATUS_ICONS[expense.status];

  return (
    <TableRow className={cn(pending && 'opacity-60')}>
      <TableCell className="text-muted-foreground w-10 text-center text-xs tabular-nums">
        {order}
      </TableCell>
      <TableCell>
        <Input
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          onBlur={saveConcept}
          className="h-8 border-transparent bg-transparent px-2 hover:border-input focus-visible:border-input"
        />
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
          <SelectTrigger size="sm" className="h-8 w-full border-transparent bg-transparent hover:border-input">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={localCurrency}>{localCurrency}</SelectItem>
            {localCurrency !== 'USD' && <SelectItem value="USD">USD</SelectItem>}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-muted-foreground w-28 text-right text-sm tabular-nums">
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
              'h-8 w-full border-transparent bg-transparent font-medium hover:border-input',
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
        <Input
          type="date"
          value={expense.dueDate ?? ''}
          onChange={(e) =>
            save({ id: expense.id, dueDate: e.target.value || null })
          }
          className="h-8 border-transparent bg-transparent px-2 hover:border-input focus-visible:border-input"
        />
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
            <DropdownMenuItem onClick={handleSaveTemplate}>
              <Bookmark className="size-4" /> Guardar como plantilla
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
