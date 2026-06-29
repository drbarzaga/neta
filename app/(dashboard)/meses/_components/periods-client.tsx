'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MoreVertical,
  FolderOpen,
  Copy,
  Lock,
  Unlock,
  Trash2,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
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
import { cn } from '@/lib/utils';
import { Money, Pct } from '@/components/money';
import { useConfirm } from '@/components/confirm-provider';
import { ProgressRing } from '@/components/progress-ring';
import { CreatePeriodDialog } from './create-period-dialog';
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

export function PeriodsClient({ periods }: { periods: PeriodCard[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Meses</h1>
          <p className="text-muted-foreground text-sm">
            Tus períodos de gastos.
          </p>
        </div>
        <CreatePeriodDialog periods={periods.map((p) => ({ id: p.id, label: p.label }))} />
      </div>

      {periods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarDays className="text-muted-foreground size-10" />
            <p className="font-medium">Todavía no tienes meses</p>
            <p className="text-muted-foreground text-sm">
              Crea tu primer mes o importa tu planilla desde la sección Importar.
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

  return (
    <Card className={cn('relative transition-shadow hover:shadow-md', pending && 'opacity-60')}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
              <CalendarDays className="size-5" />
            </span>
            <Link href={`/meses/${period.id}`} className="hover:underline">
              {period.label}
            </Link>
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1 size-8">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => router.push(`/meses/${period.id}`)}>
                <FolderOpen className="size-4" /> Abrir
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  act(() => duplicatePeriod(period.id), 'Mes duplicado al siguiente período')
                }
              >
                <Copy className="size-4" /> Duplicar al mes siguiente
              </DropdownMenuItem>
              {period.status === 'open' ? (
                <DropdownMenuItem
                  onClick={() => act(() => setPeriodStatus(period.id, 'closed'), 'Mes cerrado')}
                >
                  <Lock className="size-4" /> Cerrar mes
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => act(() => setPeriodStatus(period.id, 'open'), 'Mes reabierto')}
                >
                  <Unlock className="size-4" /> Reabrir mes
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
                <Trash2 className="size-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Badge
          variant={period.status === 'open' ? 'default' : 'secondary'}
          className="w-fit"
        >
          {period.status === 'open' ? 'Abierto' : 'Cerrado'} · {period.count} gastos
        </Badge>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-muted-foreground text-xs">Utilizado</p>
            <Money
              value={period.totalLocal}
              currency={period.localCurrency}
              locale={period.locale}
              animateOnMount
              className="text-2xl font-semibold tabular-nums"
            />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Restante</p>
            <Money
              value={period.restante}
              currency={period.localCurrency}
              locale={period.locale}
              animateOnMount
              className={cn(
                'font-medium tabular-nums',
                over ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
              )}
            />
          </div>
        </div>
        <ProgressRing
          value={pct}
          size={80}
          indicatorClassName={cn(
            over ? 'stroke-destructive' : pct > 90 ? 'stroke-amber-500' : 'stroke-primary'
          )}
        >
          <Pct
            value={period.pctUsado}
            animateOnMount
            className="text-sm font-semibold tabular-nums"
          />
        </ProgressRing>
      </CardContent>
    </Card>
  );
}
