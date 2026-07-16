'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  MapPin,
  CalendarDays,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { CategoryIcon } from '@/components/category-icon';
import { cn } from '@/lib/utils';
import {
  formatMoney,
  tripTotals,
  tripExpenseToTripCurrency,
  toUsd,
  toLocal,
  type DestinationRate,
} from '@/lib/money';
import { todayISO } from '@/lib/dates';
import { getCountry } from '@/lib/countries';
import type { Trip, TripExpense } from '@/db';
import { TripDialog } from '../../_components/trips-client';
import {
  deleteTrip,
  addTripExpense,
  updateTripExpense,
  toggleTripExpensePaid,
  deleteTripExpense,
} from '../../actions';
import { TRIP_EXPENSE_CATEGORIES, TRIP_STATUS_LABEL } from '../../schema';

function formatDate(iso: string, locale: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', className)}>{value}</p>
    </div>
  );
}

export function TripDetail({
  trip,
  expenses,
  locale,
  localCurrency,
  destinationRate,
}: {
  trip: Trip;
  expenses: TripExpense[];
  locale: string;
  localCurrency: string;
  destinationRate?: number | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [expenseDialog, setExpenseDialog] = useState<{
    open: boolean;
    expense: TripExpense | null;
  }>({ open: false, expense: null });

  const fmt = (n: number) => formatMoney(n, trip.currency, locale);
  const hasBudget = trip.budget > 0;

  // Desglose en la moneda del país de destino (vía dolarapi): convierte
  // monto-en-moneda-del-viaje -> USD (con la cotización del viaje) -> moneda
  // destino (con la cotización de ese país). Se reutiliza para totalizar
  // gastos que el usuario haya cargado directamente en esa moneda.
  const destinationCountryInfo = trip.destinationCountry
    ? getCountry(trip.destinationCountry)
    : null;
  const dest =
    destinationCountryInfo && destinationRate
      ? { currency: destinationCountryInfo.currency, rate: destinationRate }
      : null;
  const totals = tripTotals(expenses, trip.currency, trip.dollarRate, trip.budget, dest);
  const showDestinationBreakdown =
    !!destinationCountryInfo &&
    !!destinationRate &&
    destinationCountryInfo.currency !== trip.currency;
  const toDest = (n: number) => {
    const usd = toUsd({ amount: n, currency: trip.currency }, trip.dollarRate);
    return toLocal({ amount: usd, currency: 'USD' }, destinationRate ?? 0);
  };
  const fmtDest = (n: number) =>
    destinationCountryInfo
      ? formatMoney(toDest(n), destinationCountryInfo.currency, destinationCountryInfo.locale)
      : '';

  const byCategory = new Map<string, TripExpense[]>();
  for (const e of expenses) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, []);
    byCategory.get(e.category)!.push(e);
  }
  const categories = [...byCategory.keys()].sort((a, b) => a.localeCompare(b));

  async function removeTrip() {
    const ok = await confirm({
      title: 'Eliminar viaje',
      description: `Se eliminará "${trip.name}" y todos sus gastos. No se puede deshacer.`,
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    const res = await deleteTrip(trip.id);
    if (!res.ok) {
      toast.error(res.error ?? 'No se pudo eliminar');
      return;
    }
    toast.success('Viaje eliminado');
    router.push('/viajes');
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/viajes" aria-label="Volver a viajes">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <Avatar className="size-10 shrink-0">
          {trip.destinationImageUrl && (
            <AvatarImage src={trip.destinationImageUrl} alt={trip.destination ?? trip.name} />
          )}
          <AvatarFallback
            style={{ backgroundColor: `${trip.color}22`, color: trip.color }}
          >
            <CategoryIcon name={trip.icon} className="size-5" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{trip.name}</h1>
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {trip.destination && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {trip.destination}
              </span>
            )}
            {(trip.startDate || trip.endDate) && (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {trip.startDate ? formatDate(trip.startDate, locale) : '—'}
                {' – '}
                {trip.endDate ? formatDate(trip.endDate, locale) : '—'}
              </span>
            )}
          </div>
        </div>
        <Badge variant="secondary">{TRIP_STATUS_LABEL[trip.status]}</Badge>
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
            <DropdownMenuItem variant="destructive" onClick={removeTrip}>
              <Trash2 className="size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Resumen */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          {hasBudget && <Stat label="Presupuesto" value={fmt(trip.budget)} />}
          <Stat label="Pagado" value={fmt(totals.paidLocal)} />
          <Stat label="Planeado" value={fmt(totals.plannedLocal)} />
          <Stat
            label={hasBudget ? 'Restante' : 'Total'}
            value={hasBudget ? fmt(totals.remainingLocal) : fmt(totals.totalLocal)}
            className={
              hasBudget && totals.remainingLocal < 0 ? 'text-destructive' : undefined
            }
          />
        </CardContent>
        {showDestinationBreakdown && (
          <CardContent className="border-t pt-4">
            <p className="text-muted-foreground mb-2 text-xs">
              Equivalente en {destinationCountryInfo!.flag} {destinationCountryInfo!.currency}{' '}
              (cotización del día, vía dolarapi):
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
              {hasBudget && <Stat label="Presupuesto" value={fmtDest(trip.budget)} />}
              <Stat label="Pagado" value={fmtDest(totals.paidLocal)} />
              <Stat label="Planeado" value={fmtDest(totals.plannedLocal)} />
              <Stat
                label={hasBudget ? 'Restante' : 'Total'}
                value={hasBudget ? fmtDest(totals.remainingLocal) : fmtDest(totals.totalLocal)}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Gastos */}
      <Card>
        <CardHeader className="flex items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Gastos</CardTitle>
          <Button
            size="sm"
            onClick={() => setExpenseDialog({ open: true, expense: null })}
          >
            <Plus className="size-4" /> Agregar gasto
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <p className="text-muted-foreground px-6 pb-6 text-sm">
              Sin gastos registrados todavía.
            </p>
          ) : (
            <div className="divide-border divide-y">
              {categories.map((cat) => {
                const items = byCategory.get(cat)!;
                const subtotal = items.reduce(
                  (s, e) => s + tripExpenseToTripCurrency(e, trip.currency, trip.dollarRate, dest),
                  0
                );
                return (
                  <div key={cat} className="px-6 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-medium">{cat}</h3>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {fmt(subtotal)}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {items.map((e) => (
                        <TripExpenseRow
                          key={e.id}
                          expense={e}
                          locale={locale}
                          tripCurrency={trip.currency}
                          dollarRate={trip.dollarRate}
                          dest={dest}
                          onEdit={() => setExpenseDialog({ open: true, expense: e })}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TripDialog
        key={trip.id + String(editing)}
        open={editing}
        trip={trip}
        localCurrency={localCurrency}
        onOpenChange={setEditing}
      />
      <TripExpenseDialog
        key={(expenseDialog.expense?.id ?? 'new') + String(expenseDialog.open)}
        open={expenseDialog.open}
        tripId={trip.id}
        tripCurrency={trip.currency}
        destinationCurrency={dest?.currency ?? null}
        expense={expenseDialog.expense}
        onOpenChange={(o) => setExpenseDialog((d) => ({ ...d, open: o }))}
      />
    </div>
  );
}

function TripExpenseRow({
  expense,
  locale,
  tripCurrency,
  dollarRate,
  dest,
  onEdit,
}: {
  expense: TripExpense;
  locale: string;
  tripCurrency: string;
  dollarRate: number;
  dest?: DestinationRate | null;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const linked = expense.expenseId !== null;
  const fmt = (n: number) => formatMoney(n, expense.currency, locale);
  const converted = tripExpenseToTripCurrency(expense, tripCurrency, dollarRate, dest);
  const showConverted = expense.currency !== tripCurrency;

  function togglePaid(checked: boolean) {
    startTransition(async () => {
      const res = await toggleTripExpensePaid({ id: expense.id, paid: checked });
      if (!res.ok) toast.error(res.error ?? 'No se pudo actualizar');
    });
  }

  async function remove() {
    const ok = await confirm({
      title: 'Eliminar gasto',
      description: `Se eliminará "${expense.concept}".`,
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteTripExpense({ id: expense.id });
      if (!res.ok) toast.error(res.error ?? 'No se pudo eliminar');
      else toast.success('Gasto eliminado');
    });
  }

  return (
    <li className={cn('flex items-center gap-3', pending && 'opacity-60')}>
      <Checkbox
        checked={expense.paid}
        disabled={linked || pending}
        onCheckedChange={(v) => togglePaid(v === true)}
        aria-label={expense.paid ? 'Marcar como planeado' : 'Marcar como pagado'}
      />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm', expense.paid && 'text-muted-foreground line-through')}>
          {expense.concept}
        </p>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {expense.date && formatDate(expense.date, locale)}
          {linked && (
            <span className="flex items-center gap-1" title="Viene de un gasto vinculado; edítalo desde el mes">
              <Link2 className="size-3" /> vinculado al mes
            </span>
          )}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium tabular-nums">{fmt(expense.amount)}</p>
        {showConverted && (
          <p className="text-muted-foreground text-xs tabular-nums">
            ≈ {formatMoney(converted, tripCurrency, locale)}
          </p>
        )}
      </div>
      {!linked && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground size-7 shrink-0"
              aria-label="Acciones del gasto"
              disabled={pending}
            >
              <MoreVertical className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={remove}>
              <Trash2 className="size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function TripExpenseDialog({
  open,
  tripId,
  tripCurrency,
  destinationCurrency,
  expense,
  onOpenChange,
}: {
  open: boolean;
  tripId: string;
  tripCurrency: string;
  destinationCurrency?: string | null;
  expense: TripExpense | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState(expense?.category ?? 'Otro');
  const [concept, setConcept] = useState(expense?.concept ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  // Al cargar un gasto nuevo, si el viaje tiene país de destino se asume que
  // se paga en efectivo ahí (moneda local); al editar, se respeta la que tenía.
  const [currency, setCurrency] = useState(
    expense?.currency ?? destinationCurrency ?? tripCurrency
  );
  const [date, setDate] = useState(expense?.date ?? todayISO());
  const [paid, setPaid] = useState(expense?.paid ?? false);

  const isEdit = expense !== null;

  function submit() {
    if (!concept.trim()) {
      toast.error('Ponle un concepto al gasto');
      return;
    }
    const amountNum = amount === '' ? 0 : Number(amount);
    if (Number.isNaN(amountNum)) {
      toast.error('El monto debe ser un número');
      return;
    }
    const payload = {
      category: category.trim() || 'Otro',
      concept: concept.trim(),
      amount: amountNum,
      currency,
      date: date || null,
      paid,
    };
    startTransition(async () => {
      const res = isEdit
        ? await updateTripExpense({ id: expense.id, ...payload })
        : await addTripExpense({ tripId, ...payload });
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo guardar');
        return;
      }
      toast.success(isEdit ? 'Gasto actualizado' : 'Gasto agregado');
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar gasto' : 'Nuevo gasto'}</DialogTitle>
          <DialogDescription>
            Registra un gasto planeado o ya pagado del viaje.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="te-concept">Concepto</Label>
            <Input
              id="te-concept"
              value={concept}
              placeholder="Ej. Hotel 3 noches"
              onChange={(e) => setConcept(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="te-category">Categoría</Label>
            <Input
              id="te-category"
              list="trip-expense-categories"
              value={category}
              placeholder="Ej. Alojamiento"
              onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="trip-expense-categories">
              {TRIP_EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="te-amount">Monto</Label>
              <Input
                id="te-amount"
                inputMode="decimal"
                value={amount}
                placeholder="0"
                onChange={(e) => setAmount(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="te-currency">Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="te-currency" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={tripCurrency}>{tripCurrency}</SelectItem>
                  {tripCurrency !== 'USD' && <SelectItem value="USD">USD</SelectItem>}
                  {destinationCurrency &&
                    destinationCurrency !== tripCurrency &&
                    destinationCurrency !== 'USD' && (
                      <SelectItem value={destinationCurrency}>{destinationCurrency}</SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Fecha (opcional)</Label>
            <DatePicker value={date} onChange={(iso) => setDate(iso ?? '')} className="w-full" />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="te-paid"
              checked={paid}
              onCheckedChange={(v) => setPaid(v === true)}
            />
            <Label htmlFor="te-paid" className="font-normal">
              Ya está pagado
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {isEdit ? 'Guardar' : 'Agregar gasto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
