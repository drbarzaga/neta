'use client';

import { useState, useTransition } from 'react';
import { RiWalletLine } from '@remixicon/react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SalaryDepositInput } from '../schema';
import { updateSalaryDeposit } from '../actions';

export interface SalaryDepositAccountOption {
  id: string;
  name: string;
  currency: string;
}

export function SalaryDepositForm({
  initial,
  accounts,
}: {
  initial: SalaryDepositInput;
  accounts: SalaryDepositAccountOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<SalaryDepositInput>(initial);
  const [amountText, setAmountText] = useState(String(initial.amount || ''));

  function set<K extends keyof SalaryDepositInput>(key: K, value: SalaryDepositInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    const amount = amountText.trim() === '' ? 0 : Number(amountText.replace(',', '.'));
    if (Number.isNaN(amount)) {
      toast.error('El monto debe ser un número');
      return;
    }
    const payload: SalaryDepositInput = { ...form, amount };
    startTransition(async () => {
      const res = await updateSalaryDeposit(payload);
      if (!res.ok) toast.error(res.error ?? 'Error al guardar');
      else toast.success('Depósito automático guardado');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Depósito automático del sueldo</CardTitle>
        <CardDescription>
          Acredita el sueldo solo, el día que corresponda, en el apartado que elijas.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <RiWalletLine className="size-5" />
            </span>
            <div className="space-y-0.5">
              <Label>Activar depósito automático</Label>
              <p className="text-muted-foreground text-sm">
                Corre una vez por día, temprano, hora de tu país.
              </p>
            </div>
          </div>
          <Switch checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} />
        </div>

        {form.enabled && (
          <div className="ml-1 flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label>Apartado de destino</Label>
              {accounts.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Primero creá un apartado en Ahorros para poder elegirlo acá.
                </p>
              ) : (
                <Select
                  value={form.accountId ?? undefined}
                  onValueChange={(v) => {
                    set('accountId', v);
                    const acc = accounts.find((a) => a.id === v);
                    if (acc) set('currency', acc.currency);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elegí un apartado" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="salary-amount">
                Valor del sueldo{form.accountId ? ` (${form.currency})` : ''}
              </Label>
              <Input
                id="salary-amount"
                inputMode="decimal"
                value={amountText}
                placeholder="0"
                onChange={(e) => setAmountText(e.target.value)}
                className="max-w-[200px] tabular-nums"
              />
              <p className="text-muted-foreground text-xs">
                Se acredita en la moneda del apartado elegido.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label>¿Cuándo?</Label>
              <Select
                value={form.dayMode}
                onValueChange={(v) => set('dayMode', v as SalaryDepositInput['dayMode'])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_business_day">Primer día hábil del mes</SelectItem>
                  <SelectItem value="fixed_day">Día fijo del mes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.dayMode === 'fixed_day' && (
              <div className="grid max-w-[160px] gap-1.5">
                <Label htmlFor="salary-day">Día del mes</Label>
                <Input
                  id="salary-day"
                  type="number"
                  min={1}
                  max={31}
                  value={form.fixedDay}
                  onChange={(e) => set('fixedDay', Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  className="tabular-nums"
                />
                <p className="text-muted-foreground text-xs">
                  Si cae sábado o domingo, se deposita el siguiente día hábil.
                </p>
              </div>
            )}

            <p className="text-muted-foreground text-xs">
              No contempla feriados, solo fines de semana. Al correr, deja un movimiento en el
              apartado con la nota &quot;Depósito de sueldo (automático)&quot;, una sola vez por mes.
            </p>
          </div>
        )}

        <div>
          <Button onClick={save} disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
