'use client';

import { useMemo, useState } from 'react';
import { RiArrowDownSLine, RiArrowRightDownLine } from '@remixicon/react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';

const DEBT_COLOR = '#ef4444';
const SAVINGS_COLOR = '#10b981';

const round2 = (n: number) => Math.round(n * 100) / 100;

interface ChartRow {
  month: number;
  deuda: number;
  ahorro: number;
}

/** Saldo real del préstamo (cuotas fijas, sin interés) y ahorro acumulado a un ritmo constante. */
function buildData(outstandingLoan: number, monthlyPayment: number, monthlySavings: number, months: number): ChartRow[] {
  return Array.from({ length: months + 1 }, (_, month) => ({
    month,
    deuda: round2(Math.max(0, outstandingLoan - monthlyPayment * month)),
    ahorro: round2(monthlySavings * month),
  }));
}

/** Primer mes en que el ahorro acumulado alcanza o supera el saldo pendiente. */
function findCrossoverMonth(data: ChartRow[]): number | null {
  return data.find((row) => row.ahorro >= row.deuda && row.deuda > 0)?.month ?? null;
}

function ChartTooltipContent({
  active,
  payload,
  crossoverMonth,
  currency,
  locale,
}: TooltipContentProps & { crossoverMonth: number | null; currency: string; locale: string }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ChartRow;
  const readyForPayoff = crossoverMonth !== null && row.month >= crossoverMonth;

  return (
    <div className="bg-popover min-w-40 rounded-lg border px-3 py-2 text-xs shadow-xl">
      <p className="mb-1.5 font-medium">Mes {row.month}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Deuda</span>
        <span className="font-medium tabular-nums" style={{ color: DEBT_COLOR }}>
          {formatMoney(row.deuda, currency, locale)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Ahorro</span>
        <span className="font-medium tabular-nums" style={{ color: SAVINGS_COLOR }}>
          {formatMoney(row.ahorro, currency, locale)}
        </span>
      </div>
      {readyForPayoff && (
        <p className="mt-2 font-medium" style={{ color: SAVINGS_COLOR }}>
          ¡Capital listo para cancelación anticipada!
        </p>
      )}
    </div>
  );
}

function CrossoverDot({
  cx,
  cy,
  payload,
  crossoverMonth,
}: {
  cx?: number;
  cy?: number;
  payload?: ChartRow;
  crossoverMonth: number | null;
}) {
  if (cx == null || cy == null || !payload || payload.month !== crossoverMonth) {
    return <circle cx={cx} cy={cy} r={0} fill="transparent" />;
  }
  return (
    <circle cx={cx} cy={cy} r={5.5} fill={SAVINGS_COLOR} stroke="var(--background)" strokeWidth={2} />
  );
}

/** Convierte un monto entre la moneda local y USD usando la cotización del vehículo. */
function convertCurrency(
  amount: number,
  from: string,
  to: string,
  localCurrency: string,
  dollarRate: number
): number {
  if (from === to || dollarRate <= 0) return amount;
  if (from === 'USD' && to === localCurrency) return amount * dollarRate;
  if (from === localCurrency && to === 'USD') return amount / dollarRate;
  return amount;
}

export function DebtVsSavingsChart({
  outstandingLoan,
  monthlyPayment,
  remainingInstallments,
  currency,
  dollarRate,
  localCurrency,
  locale = 'es-UY',
}: {
  outstandingLoan: number;
  monthlyPayment: number;
  remainingInstallments: number;
  currency: string;
  dollarRate: number;
  localCurrency: string;
  locale?: string;
}) {
  const [open, setOpen] = useState(false);
  const [savingsInput, setSavingsInput] = useState(String(monthlyPayment || ''));
  const [savingsCurrency, setSavingsCurrency] = useState(currency);

  const savingsCurrencyOptions = useMemo(() => {
    const alt = currency === 'USD' ? localCurrency : 'USD';
    return Array.from(new Set([currency, alt]));
  }, [currency, localCurrency]);

  const rawSavings = Math.max(0, Number(savingsInput.replace(',', '.')) || 0);
  const monthlySavings = convertCurrency(rawSavings, savingsCurrency, currency, localCurrency, dollarRate);

  const data = useMemo(
    () => buildData(outstandingLoan, monthlyPayment, monthlySavings, remainingInstallments),
    [outstandingLoan, monthlyPayment, monthlySavings, remainingInstallments]
  );
  const crossoverMonth = useMemo(() => findCrossoverMonth(data), [data]);

  if (outstandingLoan <= 0 || monthlyPayment <= 0 || remainingInstallments <= 0) return null;

  const fmt = (n: number) => formatMoney(n, currency, locale);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted/60 border-border flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors"
        >
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            <RiArrowRightDownLine className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">¿Cuándo puedo cancelar a sola firma?</p>
            <p className="text-muted-foreground text-xs">
              Proyectá tu ahorro contra el saldo pendiente del préstamo
            </p>
          </div>
          <RiArrowDownSLine
            className={cn('text-muted-foreground size-4 shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 pt-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="dvs-savings">Cuánto ahorrás por mes para esto</Label>
            <div className="flex gap-2">
              <Input
                id="dvs-savings"
                inputMode="decimal"
                value={savingsInput}
                placeholder="0"
                onChange={(e) => setSavingsInput(e.target.value)}
                className="w-40 tabular-nums"
              />
              {savingsCurrencyOptions.length > 1 ? (
                <Select value={savingsCurrency} onValueChange={setSavingsCurrency}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {savingsCurrencyOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-muted-foreground flex items-center text-sm">{currency}</span>
              )}
            </div>
          </div>
        </div>

        {savingsCurrency !== currency && rawSavings > 0 && (
          <p className="text-muted-foreground -mt-2 text-xs">
            Equivale a {fmt(monthlySavings)} por mes, al tipo de cambio actual.
          </p>
        )}

        <p className="text-sm">
          {monthlySavings <= 0 ? (
            <span className="text-muted-foreground">Cargá un monto para ver la proyección.</span>
          ) : crossoverMonth !== null ? (
            <>
              Ahorrando {fmt(monthlySavings)} por mes, en el <strong>mes {crossoverMonth}</strong>{' '}
              tu fondo supera el saldo pendiente ({fmt(outstandingLoan)}) y podrías cancelar el
              préstamo a sola firma.
            </>
          ) : (
            <span className="text-muted-foreground">
              A ese ritmo no le sacás ventaja a la cancelación anticipada: terminás de pagar las
              cuotas igual, en el mes {remainingInstallments}.
            </span>
          )}
        </p>

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: DEBT_COLOR }} />
            <span className="text-muted-foreground">Saldo del préstamo</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: SAVINGS_COLOR }} />
            <span className="text-muted-foreground">Tu ahorro</span>
          </span>
        </div>

        <div className="h-[280px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="debtVsSavingsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SAVINGS_COLOR} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={SAVINGS_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(m: number) => `Mes ${m}`}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                interval={Math.max(0, Math.ceil(remainingInstallments / 8) - 1)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={56}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ stroke: 'var(--border)' }}
                content={(props) => (
                  <ChartTooltipContent
                    {...props}
                    crossoverMonth={crossoverMonth}
                    currency={currency}
                    locale={locale}
                  />
                )}
              />
              {crossoverMonth !== null && (
                <ReferenceLine
                  x={crossoverMonth}
                  stroke={SAVINGS_COLOR}
                  strokeDasharray="4 4"
                  label={{
                    value: `Mes ${crossoverMonth}`,
                    position: 'top',
                    fill: SAVINGS_COLOR,
                    fontSize: 11,
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="ahorro"
                stroke="none"
                fill="url(#debtVsSavingsGradient)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="deuda"
                name="Deuda"
                stroke={DEBT_COLOR}
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="ahorro"
                name="Ahorro"
                stroke={SAVINGS_COLOR}
                strokeWidth={2.5}
                dot={(props: { cx?: number; cy?: number; payload?: ChartRow }) => (
                  <CrossoverDot {...props} crossoverMonth={crossoverMonth} key={props.payload?.month} />
                )}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
