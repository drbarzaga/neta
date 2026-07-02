'use client';

import { useState, useTransition } from 'react';
import { CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategoryIcon } from '@/components/category-icon';
import { formatMoney } from '@/lib/money';
import { addMonths, periodLabel } from '@/lib/dates';
import type { Category } from '@/db';
import { createInstallmentPurchase } from '../actions';

/** Parsea un número tolerando coma decimal (es-UY/AR). */
function parseAmount(v: string): number {
  return Number(v.trim().replace(/\s/g, '').replace(',', '.'));
}

export function InstallmentDialog({
  categories,
  localCurrency,
  startMonth,
  startYear,
  locale = 'es-UY',
}: {
  categories: Category[];
  localCurrency: string;
  startMonth: number;
  startYear: number;
  locale?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [concept, setConcept] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(localCurrency);
  const [count, setCount] = useState('6');
  // Offset (en meses) de la primera cuota respecto al mes actual.
  const [startOffset, setStartOffset] = useState('0');

  // Opciones de "primera cuota": este mes y los próximos 11.
  const startOptions = Array.from({ length: 12 }, (_, i) => {
    const { month, year } = addMonths(startMonth, startYear, i);
    return { value: String(i), label: periodLabel(month, year) };
  });

  const amountNum = amount.trim() === '' ? 0 : parseAmount(amount);
  const countNum = Math.trunc(Number(count)) || 0;
  const total = amountNum > 0 && countNum > 0 ? amountNum * countNum : 0;
  const first = addMonths(startMonth, startYear, Number(startOffset));
  const last = addMonths(first.month, first.year, Math.max(0, countNum - 1));

  const valid =
    concept.trim() !== '' &&
    categoryId !== '' &&
    amountNum > 0 &&
    countNum >= 2;

  function reset() {
    setConcept('');
    setAmount('');
    setCount('6');
    setStartOffset('0');
    setCurrency(localCurrency);
    setCategoryId(categories[0]?.id ?? '');
  }

  function submit() {
    if (!valid) return;
    startTransition(async () => {
      const res = await createInstallmentPurchase({
        concept: concept.trim(),
        categoryId,
        currency,
        installmentAmount: amountNum,
        installmentsCount: countNum,
        startMonth: first.month,
        startYear: first.year,
      });
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo crear la compra');
        return;
      }
      const { created = 0, total: n = 0 } = res.data ?? {};
      toast.success(
        created < n
          ? `${created} de ${n} cuotas creadas; el resto se agregará al crear esos meses`
          : `${n} cuotas creadas`
      );
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CreditCard /> Compra en cuotas
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compra en cuotas</DialogTitle>
          <DialogDescription>
            Se crea una cuota en cada mes. Los meses que aún no existen reciben su
            cuota al crearse.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="inst-concept">Concepto</Label>
            <Input
              id="inst-concept"
              value={concept}
              placeholder="Ej. Heladera Mabe"
              onChange={(e) => setConcept(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Categoría</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <CategoryIcon name={c.icon} className="size-4" />
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="inst-amount">Monto por cuota</Label>
              <Input
                id="inst-amount"
                inputMode="decimal"
                value={amount}
                placeholder="0"
                onChange={(e) => setAmount(e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="grid w-24 gap-1.5">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-full">
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
            <div className="grid w-24 gap-1.5">
              <Label htmlFor="inst-count">Cuotas</Label>
              <Input
                id="inst-count"
                inputMode="numeric"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Primera cuota</Label>
            <Select value={startOffset} onValueChange={setStartOffset}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {startOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {total > 0 && countNum >= 2 && (
            <div className="bg-muted/50 rounded-lg border px-3 py-2.5 text-sm">
              <p className="font-medium">
                {countNum} cuotas de {formatMoney(amountNum, currency, locale)} ={' '}
                {formatMoney(total, currency, locale)}
              </p>
              <p className="text-muted-foreground text-xs">
                Desde {periodLabel(first.month, first.year)} hasta{' '}
                {periodLabel(last.month, last.year)}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || !valid}>
            {pending ? 'Creando…' : 'Crear cuotas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
