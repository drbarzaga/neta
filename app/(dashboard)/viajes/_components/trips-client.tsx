'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Plus,
  Plane,
  MoreVertical,
  Pencil,
  Trash2,
  CalendarDays,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { IconPicker } from '@/components/icon-picker';
import { CategoryIcon } from '@/components/category-icon';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { createTrip, updateTrip, deleteTrip } from '../actions';
import { TRIP_STATUS_LABEL } from '../schema';
import type { TripWithTotals } from '../queries';
import type { Trip } from '@/db';

const STATUS_BADGE_CLASS: Record<Trip['status'], string> = {
  planificando: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  en_curso: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  completado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
};

function formatDate(iso: string, locale: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function TripsClient({
  trips,
  locale,
  localCurrency,
  defaultDollarRate,
}: {
  trips: TripWithTotals[];
  locale: string;
  localCurrency: string;
  defaultDollarRate: number;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; trip: Trip | null }>({
    open: false,
    trip: null,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Viajes</h1>
          <p className="text-muted-foreground mt-1 text-base">
            Planifica tus viajes y lleva el control de sus gastos.
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, trip: null })}>
          <Plus /> Nuevo viaje
        </Button>
      </div>

      {trips.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
              <Plane className="size-7" />
            </span>
            <div className="space-y-1">
              <p className="font-medium">Todavía no tienes viajes</p>
              <p className="text-muted-foreground text-sm">
                Crea uno para empezar a planificarlo y seguir sus gastos.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setDialog({ open: true, trip: null })}
            >
              <Plus /> Crear viaje
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((t) => (
            <TripCard
              key={t.id}
              trip={t}
              locale={locale}
              onEdit={() => setDialog({ open: true, trip: t })}
            />
          ))}
        </div>
      )}

      <TripDialog
        key={dialog.trip?.id ?? 'new'}
        open={dialog.open}
        trip={dialog.trip}
        localCurrency={localCurrency}
        defaultDollarRate={defaultDollarRate}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
      />
    </div>
  );
}

function TripCard({
  trip,
  locale,
  onEdit,
}: {
  trip: TripWithTotals;
  locale: string;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const fmt = (n: number) => formatMoney(n, trip.currency, locale);

  const hasBudget = trip.budget > 0;
  const pct = hasBudget
    ? Math.min(100, Math.max(0, (trip.totals.totalLocal / trip.budget) * 100))
    : 0;
  const over = hasBudget && trip.totals.totalLocal > trip.budget;

  async function remove() {
    const ok = await confirm({
      title: 'Eliminar viaje',
      description: `Se eliminará "${trip.name}" y todos sus gastos. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteTrip(trip.id);
      if (!res.ok) toast.error(res.error ?? 'No se pudo eliminar');
      else toast.success('Viaje eliminado');
    });
  }

  return (
    <Card className={cn('flex flex-col', pending && 'opacity-60')}>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <Link
          href={`/viajes/${trip.id}`}
          className="group flex min-w-0 items-center gap-2.5"
        >
          <Avatar className="size-9 shrink-0">
            {trip.destinationImageUrl && (
              <AvatarImage src={trip.destinationImageUrl} alt={trip.destination ?? trip.name} />
            )}
            <AvatarFallback
              style={{ backgroundColor: `${trip.color}22`, color: trip.color }}
            >
              <CategoryIcon name={trip.icon} className="size-5" />
            </AvatarFallback>
          </Avatar>
          <CardTitle className="truncate text-base group-hover:underline">
            {trip.name}
          </CardTitle>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground -mr-2 -mt-1 size-8 shrink-0"
              aria-label="Acciones del viaje"
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
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={STATUS_BADGE_CLASS[trip.status]}>
            {TRIP_STATUS_LABEL[trip.status]}
          </Badge>
          {trip.destination && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <MapPin className="size-3.5" /> {trip.destination}
            </span>
          )}
        </div>

        {(trip.startDate || trip.endDate) && (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <CalendarDays className="size-3.5" />
            {trip.startDate ? formatDate(trip.startDate, locale) : '—'}
            {' – '}
            {trip.endDate ? formatDate(trip.endDate, locale) : '—'}
          </p>
        )}

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm font-medium tabular-nums">
              {fmt(trip.totals.totalLocal)}
            </span>
            {hasBudget && (
              <span className="text-muted-foreground text-xs tabular-nums">
                de {fmt(trip.budget)}
              </span>
            )}
          </div>
          {hasBudget && (
            <>
              <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: over ? 'var(--destructive)' : trip.color,
                  }}
                />
              </div>
              <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs tabular-nums">
                <span>{Math.round(pct)}%</span>
                <span className={cn(over && 'text-destructive')}>
                  {over ? 'te pasaste' : `quedan ${fmt(trip.totals.remainingLocal)}`}
                </span>
              </div>
            </>
          )}
          <div className="text-muted-foreground mt-1.5 flex items-center justify-between text-xs tabular-nums">
            <span>Pagado: {fmt(trip.totals.paidLocal)}</span>
            <span>Planeado: {fmt(trip.totals.plannedLocal)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TripDialog({
  open,
  trip,
  localCurrency,
  defaultDollarRate = 0,
  onOpenChange,
}: {
  open: boolean;
  trip: Trip | null;
  localCurrency: string;
  defaultDollarRate?: number;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(trip?.name ?? '');
  const [destination, setDestination] = useState(trip?.destination ?? '');
  const [startDate, setStartDate] = useState(trip?.startDate ?? '');
  const [endDate, setEndDate] = useState(trip?.endDate ?? '');
  const [currency, setCurrency] = useState(trip?.currency ?? localCurrency);
  // Al crear, precarga la cotización vigente (la del header); al editar, la que
  // ya tenía guardada el viaje. En ambos casos el usuario puede cambiarla.
  const [dollarRate, setDollarRate] = useState(
    trip && trip.dollarRate ? String(trip.dollarRate) : defaultDollarRate ? String(defaultDollarRate) : ''
  );
  const [budget, setBudget] = useState(trip && trip.budget ? String(trip.budget) : '');
  const [status, setStatus] = useState<Trip['status']>(trip?.status ?? 'planificando');
  const [icon, setIcon] = useState(trip?.icon ?? 'plane');
  const [color, setColor] = useState(trip?.color ?? '#0ea5e9');

  const isEdit = trip !== null;

  function submit() {
    if (!name.trim()) {
      toast.error('Ponle un nombre al viaje');
      return;
    }
    const payload = {
      name: name.trim(),
      destination: destination.trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
      currency,
      dollarRate: dollarRate === '' ? 0 : Number(dollarRate),
      budget: budget === '' ? 0 : Number(budget),
      icon,
      color,
    };
    if (Number.isNaN(payload.dollarRate) || Number.isNaN(payload.budget)) {
      toast.error('Los montos deben ser números');
      return;
    }
    startTransition(async () => {
      const res = isEdit
        ? await updateTrip({ id: trip.id, ...payload, status })
        : await createTrip(payload);
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo guardar');
        return;
      }
      toast.success(isEdit ? 'Viaje actualizado' : 'Viaje creado');
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar viaje' : 'Nuevo viaje'}</DialogTitle>
          <DialogDescription>
            Define el destino, las fechas y un presupuesto opcional.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="trip-name">Nombre</Label>
            <Input
              id="trip-name"
              value={name}
              placeholder="Ej. Vacaciones en Bariloche"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="trip-destination">Destino (opcional)</Label>
            <Input
              id="trip-destination"
              value={destination}
              placeholder="Ej. Bariloche, Argentina"
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Inicio (opcional)</Label>
              <DatePicker
                value={startDate}
                onChange={(iso) => setStartDate(iso ?? '')}
                className="w-full"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Fin (opcional)</Label>
              <DatePicker
                value={endDate}
                onChange={(iso) => setEndDate(iso ?? '')}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr_auto] grid-rows-[auto_auto] gap-x-3 gap-y-1.5">
            <div className="grid grid-rows-subgrid row-span-2">
              <Label htmlFor="trip-budget">Presupuesto (opcional)</Label>
              <Input
                id="trip-budget"
                inputMode="decimal"
                value={budget}
                placeholder="0"
                onChange={(e) => setBudget(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="grid grid-rows-subgrid row-span-2">
              <Label htmlFor="trip-rate">Cotización USD (opcional)</Label>
              <Input
                id="trip-rate"
                inputMode="decimal"
                value={dollarRate}
                placeholder="0"
                onChange={(e) => setDollarRate(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="grid grid-rows-subgrid row-span-2">
              <Label htmlFor="trip-currency">Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="trip-currency" className="w-24">
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

          {isEdit && (
            <div className="grid gap-1.5">
              <Label htmlFor="trip-status">Estado</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as Trip['status'])}
              >
                <SelectTrigger id="trip-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planificando">Planificando</SelectItem>
                  <SelectItem value="en_curso">En curso</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-end gap-4">
            <div className="grid gap-1.5">
              <Label>Icono</Label>
              <IconPicker value={icon} color={color} onChange={setIcon} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="trip-color">Color</Label>
              <Input
                id="trip-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 p-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {isEdit ? 'Guardar' : 'Crear viaje'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
