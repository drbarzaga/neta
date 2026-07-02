'use client';

import { useState, useTransition } from 'react';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatMoney } from '@/lib/money';
import { convertExpenseToInstallments } from '../actions';

const round2 = (x: number) => Math.round(x * 100) / 100;

export function ConvertToInstallmentsDialog({
  open,
  onOpenChange,
  expenseId,
  concept,
  amount,
  currency,
  locale = 'es-UY',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string;
  concept: string;
  amount: number;
  currency: string;
  locale?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [count, setCount] = useState('6');
  const [mode, setMode] = useState<'total' | 'each'>('total');

  const n = Math.trunc(Number(count)) || 0;
  const amountIsTotal = mode === 'total';
  const perCuota = n >= 2 ? (amountIsTotal ? round2(amount / n) : amount) : 0;
  const total = amountIsTotal ? amount : round2(amount * n);
  const valid = n >= 2 && amount > 0;

  function submit() {
    if (!valid) return;
    startTransition(async () => {
      const res = await convertExpenseToInstallments({
        id: expenseId,
        installmentsCount: n,
        amountIsTotal,
      });
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo convertir');
        return;
      }
      const { created = 0, total: t = 0 } = res.data ?? {};
      toast.success(
        created < t
          ? `Convertido en ${t} cuotas (${created} creadas; el resto al crear esos meses)`
          : `Convertido en ${t} cuotas`
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convertir en cuotas</DialogTitle>
          <DialogDescription>
            «{concept}» pasará a ser la cuota 1 y se crearán las siguientes en los
            próximos meses.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>El monto de {formatMoney(amount, currency, locale)} es…</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as 'total' | 'each')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">El total (dividir en cuotas)</SelectItem>
                <SelectItem value="each">El monto de cada cuota</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid w-32 gap-1.5">
            <Label htmlFor="conv-count">Cantidad de cuotas</Label>
            <Input
              id="conv-count"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="tabular-nums"
            />
          </div>

          {valid && (
            <div className="bg-muted/50 rounded-lg border px-3 py-2.5 text-sm">
              <p className="font-medium">
                {n} cuotas de {formatMoney(perCuota, currency, locale)} ={' '}
                {formatMoney(total, currency, locale)}
              </p>
              {amountIsTotal && perCuota * n !== total && (
                <p className="text-muted-foreground text-xs">
                  La cuota 1 ajusta los centavos para cuadrar el total.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || !valid}>
            {pending ? 'Convirtiendo…' : 'Convertir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
