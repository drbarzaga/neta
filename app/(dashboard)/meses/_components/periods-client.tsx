'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RiMore2Line, RiFolderOpenLine, RiFileCopyLine, RiFileCopy2Line, RiLockLine, RiLockUnlockLine, RiDeleteBinLine, RiCalendarLine } from '@remixicon/react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Money, Pct } from '@/components/money';
import { useConfirm } from '@/components/confirm-provider';
import { nextMonth } from '@/lib/dates';
import { CreatePeriodDialog } from './create-period-dialog';
import { CreateYearDialog } from './create-year-dialog';
import { duplicatePeriod, setPeriodStatus, deletePeriod } from '../actions';

interface PeriodCard {
  id: string;
  label: string;
  year: number;
  month: number;
  status: 'open' | 'closed';
  incomeTotal: number;
  totalLocal: number;
  restante: number;
  pctUsado: number;
  count: number;
  localCurrency: string;
  locale: string;
}

export function PeriodsClient({
  periods,
  allPeriodLabels,
  years,
  year,
}: {
  periods: PeriodCard[];
  allPeriodLabels: { id: string; label: string }[];
  years: number[];
  year: number;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Períodos</p>
          <h1 className="font-heading mt-1 text-[46px] leading-none font-bold tracking-tight [letter-spacing:-0.025em]">
            Meses
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(y) => router.push(`/meses?year=${y}`)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CreateYearDialog />
          <CreatePeriodDialog periods={allPeriodLabels} />
        </div>
      </div>

      {periods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <RiCalendarLine className="text-muted-foreground size-10" />
            <p className="font-medium">Todavía no tienes meses en {year}</p>
            <p className="text-muted-foreground text-sm">
              Crea el primero de {year} o importa tu planilla desde la sección Importar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {periods.map((p) => (
            <PeriodGridCard key={p.id} period={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PeriodGridCard({ period }: { period: PeriodCard }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const pct = Math.min(100, Math.max(0, period.pctUsado));
  const over = period.restante < 0;

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? 'Error');
      else toast.success(success);
    });
  }

  function duplicate(resetAmounts: boolean) {
    const target = nextMonth(period.month, period.year);
    startTransition(async () => {
      const res = await duplicatePeriod(period.id, resetAmounts);
      if (!res.ok) {
        toast.error(res.error ?? 'Error');
        return;
      }
      toast.success(resetAmounts ? 'Mes duplicado con montos en $0' : 'Mes duplicado al siguiente período');
      // Si el nuevo mes cae en otro año, lleva al usuario ahí para que lo vea.
      if (target.year !== period.year) router.push(`/meses?year=${target.year}`);
    });
  }

  return (
    <Card className={cn('relative', pending && 'opacity-60')}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">
            <Link href={`/meses/${period.id}`} className="hover:underline">
              {period.label}
            </Link>
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1 size-8">
                <RiMore2Line className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => router.push(`/meses/${period.id}`)}>
                <RiFolderOpenLine className="size-4" /> Abrir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicate(false)}>
                <RiFileCopyLine className="size-4" /> Duplicar al mes siguiente
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicate(true)}>
                <RiFileCopy2Line className="size-4" /> Duplicar sin montos ($0)
              </DropdownMenuItem>
              {period.status === 'open' ? (
                <DropdownMenuItem
                  onClick={() => act(() => setPeriodStatus(period.id, 'closed'), 'Mes cerrado')}
                >
                  <RiLockLine className="size-4" /> Cerrar mes
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => act(() => setPeriodStatus(period.id, 'open'), 'Mes reabierto')}
                >
                  <RiLockUnlockLine className="size-4" /> Reabrir mes
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Eliminar mes',
                    description: `Se eliminará "${period.label}" y todos sus gastos. Esta acción no se puede deshacer.`,
                    confirmText: 'Eliminar',
                    destructive: true,
                  });
                  if (ok) act(() => deletePeriod(period.id), 'Mes eliminado');
                }}
              >
                <RiDeleteBinLine className="size-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Badge variant={period.status === 'open' ? 'forest' : 'neutral'} className="w-fit">
          {period.status === 'open' ? 'Abierto' : 'Cerrado'} · {period.count} gastos
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="text-(--ink-2) text-xs">Utilizado</p>
          <Money
            value={period.totalLocal}
            currency={period.localCurrency}
            locale={period.locale}
            animateOnMount
            className="font-heading text-[32px] leading-none font-bold tabular-nums [letter-spacing:-0.025em]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E6E9E0]">
            <div
              className={cn('h-full rounded-full', over ? 'bg-(--coral)' : 'bg-(--forest)')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <Pct
            value={period.pctUsado}
            animateOnMount
            className="font-mono text-xs text-(--ink-3) tabular-nums"
          />
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t border-(--line) pt-(--card-spacing)">
        <span className="text-(--ink-2) text-xs">Restante</span>
        <Money
          value={period.restante}
          currency={period.localCurrency}
          locale={period.locale}
          animateOnMount
          className={cn('font-mono text-sm font-medium tabular-nums', over && 'text-(--coral)')}
        />
      </CardFooter>
    </Card>
  );
}
