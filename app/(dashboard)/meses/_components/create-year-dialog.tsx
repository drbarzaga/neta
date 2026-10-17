'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarRange } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createYearPeriods } from '../actions';

export function CreateYearDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear + 1, currentYear + 2];
  const [year, setYear] = useState(String(currentYear + 1));

  function submit() {
    startTransition(async () => {
      const res = await createYearPeriods({ year: Number(year) });
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo crear el año');
        return;
      }
      setOpen(false);
      const created = res.data?.created ?? 0;
      const skipped = res.data?.skipped ?? 0;
      toast.success(
        created > 0
          ? `Se crearon ${created} meses de ${year}${skipped > 0 ? ` (${skipped} ya existían)` : ''}`
          : `Los 12 meses de ${year} ya existían`
      );
      router.push(`/meses?year=${year}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarRange className="size-4" /> Crear año completo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear año completo</DialogTitle>
          <DialogDescription>
            Crea de una vez los 12 meses del año que elijas, vacíos y con ingreso en $0. Los
            gastos recurrentes y las cuotas de compras en curso se arrastran igual que en un mes
            nuevo en blanco.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5 py-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'Creando…' : `Crear 12 meses de ${year}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
