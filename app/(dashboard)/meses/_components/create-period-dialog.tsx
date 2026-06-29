'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MONTHS_ES } from '@/lib/dates';
import { createPeriod } from '../actions';

export function CreatePeriodDialog({
  periods,
}: {
  periods: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [income, setIncome] = useState('');
  const [cloneFromId, setCloneFromId] = useState<string>('none');

  function submit() {
    startTransition(async () => {
      const res = await createPeriod({
        month: Number(month),
        year: Number(year),
        incomeTotal: income === '' ? 0 : Number(income),
        cloneFromId: cloneFromId === 'none' ? null : cloneFromId,
      });
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo crear el mes');
        return;
      }
      setOpen(false);
      toast.success('Mes creado');
      if (res.data?.id) router.push(`/meses/${res.data.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nuevo mes
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo mes</DialogTitle>
          <DialogDescription>
            Crea un período. Puedes clonar los conceptos de un mes anterior.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Mes</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS_ES.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="year">Año</Label>
              <Input
                id="year"
                inputMode="numeric"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="income">Ingreso total (moneda local)</Label>
            <Input
              id="income"
              inputMode="decimal"
              placeholder="0"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </div>
          {periods.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Clonar conceptos de</Label>
              <Select value={cloneFromId} onValueChange={setCloneFromId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No clonar (vacío)</SelectItem>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Creando…' : 'Crear mes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
