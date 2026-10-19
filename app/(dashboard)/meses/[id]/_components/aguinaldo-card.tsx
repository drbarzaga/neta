'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { RiGiftLine, RiCloseLine, RiAddLine, RiDeleteBinLine } from '@remixicon/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CategoryIcon } from '@/components/category-icon';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { MONTHS_ES } from '@/lib/dates';
import type { Goal, SavingsAccount } from '@/db';
import { distributeAguinaldo } from '../actions';

interface Destination {
  key: string; // `${kind}:${id}`
  kind: 'goal' | 'savings';
  id: string;
  label: string;
  currency: string;
  icon: string;
  color: string;
}

interface Row {
  rowKey: string;
  destinationKey: string;
  amount: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const parseAmount = (v: string) => Number(v.trim().replace(',', '.')) || 0;

function dismissKey(month: number, year: number) {
  return `aguinaldo-dismissed:${year}-${month}`;
}

function AguinaldoDialog({
  open,
  onOpenChange,
  destinations,
  dollarRate,
  localCurrency,
  locale,
  onDistributed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinations: Destination[];
  dollarRate: number;
  localCurrency: string;
  locale: string;
  onDistributed: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [currency, setCurrency] = useState(localCurrency);
  const [totalInput, setTotalInput] = useState('');
  const nextRowId = useRef(1);
  const [rows, setRows] = useState<Row[]>([]);

  const currencyOptions = Array.from(new Set([localCurrency, 'USD']));
  const total = parseAmount(totalInput);
  const allocated = round2(rows.reduce((s, r) => s + parseAmount(r.amount), 0));
  const remaining = round2(total - allocated);
  const fmt = (n: number) => formatMoney(n, currency, locale);

  function addRow() {
    const used = new Set(rows.map((r) => r.destinationKey));
    const next = destinations.find((d) => !used.has(d.key));
    setRows((rs) => [
      ...rs,
      { rowKey: String(nextRowId.current++), destinationKey: next?.key ?? '', amount: '' },
    ]);
  }

  function removeRow(rowKey: string) {
    setRows((rs) => rs.filter((r) => r.rowKey !== rowKey));
  }

  function updateRow(rowKey: string, fields: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.rowKey === rowKey ? { ...r, ...fields } : r)));
  }

  function reset() {
    setRows([]);
    setTotalInput('');
  }

  const validRows = rows.filter((r) => r.destinationKey && parseAmount(r.amount) > 0);

  function submit() {
    if (validRows.length === 0) return;
    startTransition(async () => {
      const res = await distributeAguinaldo({
        currency,
        dollarRate,
        allocations: validRows.map((r) => {
          const [kind, id] = r.destinationKey.split(':');
          return { kind: kind as 'goal' | 'savings', targetId: id, amount: parseAmount(r.amount) };
        }),
      });
      if (!res.ok) {
        toast.error(res.error ?? 'Error al distribuir');
        return;
      }
      toast.success(`Aguinaldo repartido en ${res.data?.count ?? validRows.length} destino(s)`);
      reset();
      onOpenChange(false);
      onDistributed();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>Distribuir aguinaldo</DialogTitle>
          <DialogDescription>
            Repartilo entre tus metas y apartados de ahorro. Cada destino queda con su abono en el historial, como uno manual.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="aguinaldo-total">Monto del aguinaldo (referencia)</Label>
                <Input
                  id="aguinaldo-total"
                  inputMode="decimal"
                  placeholder="0"
                  value={totalInput}
                  onChange={(e) => setTotalInput(e.target.value)}
                  className="w-40 tabular-nums"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="aguinaldo-currency">Moneda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="aguinaldo-currency" className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {rows.map((row) => {
                const dest = destinations.find((d) => d.key === row.destinationKey);
                return (
                  <div key={row.rowKey} className="flex items-center gap-2">
                    <Select
                      value={row.destinationKey}
                      onValueChange={(v) => updateRow(row.rowKey, { destinationKey: v })}
                    >
                      <SelectTrigger className="h-9 min-w-0 flex-1">
                        <SelectValue placeholder="Elegí un destino">
                          {dest && (
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className="flex size-5 shrink-0 items-center justify-center rounded-md"
                                style={{ backgroundColor: `${dest.color}33`, color: dest.color }}
                              >
                                <CategoryIcon name={dest.icon} className="size-3" />
                              </span>
                              <span className="truncate">{dest.label}</span>
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Metas</SelectLabel>
                          {destinations
                            .filter((d) => d.kind === 'goal')
                            .map((d) => (
                              <SelectItem key={d.key} value={d.key}>
                                {d.label}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Ahorros</SelectLabel>
                          {destinations
                            .filter((d) => d.kind === 'savings')
                            .map((d) => (
                              <SelectItem key={d.key} value={d.key}>
                                {d.label}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Input
                      inputMode="decimal"
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) => updateRow(row.rowKey, { amount: e.target.value })}
                      className="h-9 w-28 shrink-0 tabular-nums"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground size-9 shrink-0"
                          onClick={() => removeRow(row.rowKey)}
                          aria-label="Quitar destino"
                        >
                          <RiDeleteBinLine className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Quitar destino</TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={addRow}
                disabled={rows.length >= destinations.length}
              >
                <RiAddLine className="size-4" /> Agregar destino
              </Button>
            </div>

            {(total > 0 || allocated > 0) && (
              <p className="text-sm">
                Repartido <span className="font-medium tabular-nums">{fmt(allocated)}</span>
                {total > 0 && (
                  <>
                    {' '}
                    de <span className="font-medium tabular-nums">{fmt(total)}</span> · Resta{' '}
                    <span
                      className={cn('font-medium tabular-nums', remaining < 0 && 'text-[var(--coral)]')}
                    >
                      {fmt(remaining)}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || validRows.length === 0}>
            {pending ? 'Distribuyendo…' : 'Distribuir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AguinaldoCard({
  month,
  year,
  dollarRate,
  localCurrency,
  locale = 'es-UY',
  goals,
  savingsAccounts,
}: {
  month: number;
  year: number;
  dollarRate: number;
  localCurrency: string;
  locale?: string;
  goals: Goal[];
  savingsAccounts: SavingsAccount[];
}) {
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  // Se lee tras montar (no en el estado inicial) para no romper la hidratación.
  useEffect(() => {
    void (async () => {
      try {
        if (localStorage.getItem(dismissKey(month, year)) === '1') setDismissed(true);
      } catch {}
    })();
  }, [month, year]);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey(month, year), '1');
    } catch {}
  }

  const destinations: Destination[] = [
    ...goals.map((g) => ({
      key: `goal:${g.id}`,
      kind: 'goal' as const,
      id: g.id,
      label: g.title,
      currency: g.currency,
      icon: g.icon,
      color: g.color,
    })),
    ...savingsAccounts.map((a) => ({
      key: `savings:${a.id}`,
      kind: 'savings' as const,
      id: a.id,
      label: a.name,
      currency: a.currency,
      icon: a.icon,
      color: a.color,
    })),
  ];

  if (dismissed || destinations.length === 0) return null;

  const monthName = MONTHS_ES[month - 1] ?? '';

  return (
    <>
      <Card className="border-[var(--forest)]/25 bg-[var(--forest-soft)]">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <span className="bg-background text-[var(--forest)] flex size-10 shrink-0 items-center justify-center rounded-xl">
            <RiGiftLine className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Llegó el aguinaldo de {monthName}</p>
            <p className="text-muted-foreground text-xs">
              Repartilo entre tus metas y ahorros antes de que se mezcle con el resto.
            </p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            Distribuir aguinaldo
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground shrink-0"
                onClick={dismiss}
                aria-label="Descartar"
              >
                <RiCloseLine className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Descartar</TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>
      <AguinaldoDialog
        open={open}
        onOpenChange={setOpen}
        destinations={destinations}
        dollarRate={dollarRate}
        localCurrency={localCurrency}
        locale={locale}
        onDistributed={dismiss}
      />
    </>
  );
}
