'use client';

import { useState, useTransition } from 'react';
import { DollarSign, RefreshCw } from 'lucide-react';
import NumberFlow from '@number-flow/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { refreshGlobalRate, setGlobalRate } from '../rate-actions';

export function DollarRate({
  initialRate,
  localCurrency,
  locale,
}: {
  initialRate: number;
  localCurrency: string;
  locale: string;
}) {
  const [rate, setRate] = useState(initialRate);
  const [draft, setDraft] = useState(String(initialRate));
  const [refreshing, setRefreshing] = useState(false);
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function save() {
    const v = draft.trim() === '' ? NaN : Number(draft);
    if (Number.isNaN(v) || v <= 0) {
      setDraft(String(rate));
      return;
    }
    if (v === rate) return;
    startTransition(async () => {
      const res = await setGlobalRate(v);
      if (!res.ok) {
        toast.error(res.error ?? 'Error');
        setDraft(String(rate));
      } else if (res.data) {
        setRate(res.data.rate);
        toast.success('Cotización actualizada');
      }
    });
  }

  function refresh() {
    setRefreshing(true);
    refreshGlobalRate().then((res) => {
      setRefreshing(false);
      if (!res.ok) {
        toast.error(res.error ?? 'No se pudo actualizar');
        return;
      }
      if (res.data) {
        setRate(res.data.rate);
        setDraft(String(res.data.rate));
        toast.success(`Dólar hoy: ${res.data.rate}`);
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 font-medium tabular-nums">
          <DollarSign className="size-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-muted-foreground hidden sm:inline">USD</span>
          <NumberFlow
            value={rate}
            locales={locale}
            prefix="$ "
            format={{ maximumFractionDigits: 2 }}
          />
          <span className="text-muted-foreground hidden sm:inline">{localCurrency}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="grid gap-3">
          <div>
            <p className="font-medium">Cotización del dólar</p>
            <p className="text-muted-foreground text-xs">
              USD → {localCurrency}. Se usa al crear meses nuevos.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="rate-input">Valor ({localCurrency} por USD)</Label>
              <Input
                id="rate-input"
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                className="tabular-nums"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={refresh}
              disabled={refreshing}
              aria-label="Traer cotización de hoy"
            >
              <RefreshCw className={cn(refreshing && 'animate-spin')} />
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Fuente:{' '}
            <a
              href="https://uy.dolarapi.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground underline underline-offset-2"
            >
              dolarapi.com
            </a>
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
