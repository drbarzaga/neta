'use client';

import { useEffect, useMemo, useState } from 'react';
import { RiArrowDownSLine, RiArrowRightDownLine } from '@remixicon/react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
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
import { periodLabel, MONTHS_ES } from '@/lib/dates';

const DEBT_COLOR = '#ef4444';
const SAVINGS_COLOR = '#10b981';
const CAPITAL_COLOR = '#1e293b';

const round2 = (n: number) => Math.round(n * 100) / 100;

interface ChartRow {
  month: number;
  deuda: number;
  ahorro: number;
  /** Saldo de capital real (sin interés/IVA/recargos), si se pudo calcular. */
  capital?: number;
}

/**
 * Saldo restante de cuotas (capital+interés+IVA+recargos, sin indexar a
 * futuro) y ahorro acumulado a un ritmo constante. `capitalSchedule`, si se
 * pasa, es el saldo de capital real mes a mes (ver `buildCapitalSchedule`).
 */
function buildData(
  outstandingLoan: number,
  monthlyPayment: number,
  monthlySavings: number,
  months: number,
  capitalSchedule?: number[] | null
): ChartRow[] {
  return Array.from({ length: months + 1 }, (_, month) => ({
    month,
    deuda: round2(Math.max(0, outstandingLoan - monthlyPayment * month)),
    ahorro: round2(monthlySavings * month),
    capital: capitalSchedule?.[month],
  }));
}

/** Primer mes en que el ahorro acumulado alcanza o supera el saldo pendiente. */
function findCrossoverMonth(data: ChartRow[]): number | null {
  return data.find((row) => row.ahorro >= row.deuda && row.deuda > 0)?.month ?? null;
}

/** Mes/año calendario que cae `offset` meses después del mes/año base (mes 0 = hoy). */
function monthYearAt(baseMonth: number, baseYear: number, offset: number): { month: number; year: number } {
  const total = baseMonth - 1 + offset;
  const month = (((total % 12) + 12) % 12) + 1;
  const year = baseYear + Math.floor(total / 12);
  return { month, year };
}

function addMonthsLabel(baseMonth: number, baseYear: number, offset: number): string {
  const { month, year } = monthYearAt(baseMonth, baseYear, offset);
  return periodLabel(month, year);
}

/** "jul 2027", para espacios angostos como el encabezado de la tabla. */
function addMonthsShortLabel(baseMonth: number, baseYear: number, offset: number): string {
  const { month, year } = monthYearAt(baseMonth, baseYear, offset);
  const name = MONTHS_ES[month - 1]?.slice(0, 3).toLowerCase() ?? '';
  return `${name} ${year}`;
}

/** ~8 meses repartidos a lo largo del plazo (más el mes de cruce, si no cae justo en uno de ellos). */
function sampleMonths(data: ChartRow[], months: number, crossoverMonth: number | null): ChartRow[] {
  const step = Math.max(1, Math.round(months / 7));
  const picked = new Set<number>();
  for (let m = 0; m <= months; m += step) picked.add(m);
  picked.add(months);
  if (crossoverMonth !== null) picked.add(crossoverMonth);
  return Array.from(picked)
    .sort((a, b) => a - b)
    .map((m) => data[m])
    .filter((row): row is ChartRow => row !== undefined);
}

function ChartTooltipContent({
  active,
  payload,
  crossoverMonth,
  currency,
  locale,
  baseMonth,
  baseYear,
}: TooltipContentProps & {
  crossoverMonth: number | null;
  currency: string;
  locale: string;
  baseMonth: number;
  baseYear: number;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ChartRow;
  const readyForPayoff = crossoverMonth !== null && row.month >= crossoverMonth;

  return (
    <div className="bg-popover min-w-40 rounded-lg border px-3 py-2 text-xs shadow-xl">
      <p className="mb-1.5 font-medium">
        Mes {row.month} · {addMonthsLabel(baseMonth, baseYear, row.month)}
      </p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Deuda</span>
        <span className="font-medium tabular-nums" style={{ color: DEBT_COLOR }}>
          {formatMoney(row.deuda, currency, locale)}
        </span>
      </div>
      {row.capital != null && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Capital</span>
          <span className="font-medium tabular-nums" style={{ color: CAPITAL_COLOR }}>
            {formatMoney(row.capital, currency, locale)}
          </span>
        </div>
      )}
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

/** Insignia flotante "Mes N" sobre la barra del mes de cruce. */
function CrossoverBarBadge(props: {
  x?: number;
  y?: number;
  width?: number;
  value?: unknown;
  crossoverMonth: number | null;
}) {
  const { x, y, width, value, crossoverMonth } = props;
  if (x == null || y == null || width == null || crossoverMonth == null || Number(value) !== crossoverMonth) {
    return null;
  }
  const text = `Mes ${crossoverMonth}`;
  const badgeWidth = text.length * 6.5 + 18;
  return (
    <g transform={`translate(${x + width / 2 - badgeWidth / 2}, ${y - 26})`}>
      <rect width={badgeWidth} height={20} rx={10} fill={SAVINGS_COLOR} />
      <text x={badgeWidth / 2} y={14} textAnchor="middle" fontSize={11} fontWeight={600} fill="#06281d">
        {text}
      </text>
    </g>
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

/** Clave de localStorage para recordar el monto/moneda de ahorro simulado, por vehículo. */
const savingsStorageKey = (vehicleId: string) => `dvs-savings:${vehicleId}`;

export function DebtVsSavingsChart({
  vehicleId,
  outstandingLoan,
  monthlyPayment,
  remainingInstallments,
  currency,
  dollarRate,
  localCurrency,
  locale = 'es-UY',
  capitalSchedule,
}: {
  vehicleId: string;
  outstandingLoan: number;
  monthlyPayment: number;
  remainingInstallments: number;
  currency: string;
  dollarRate: number;
  localCurrency: string;
  locale?: string;
  /** Saldo de capital real mes a mes (ver `buildCapitalSchedule`), si está disponible. */
  capitalSchedule?: number[] | null;
}) {
  const [open, setOpen] = useState(false);
  const [savingsInput, setSavingsInput] = useState(String(monthlyPayment || ''));
  const [savingsCurrency, setSavingsCurrency] = useState(currency);

  // Se lee tras montar (no en el estado inicial) para no romper la hidratación.
  useEffect(() => {
    void (async () => {
      try {
        const raw = localStorage.getItem(savingsStorageKey(vehicleId));
        if (!raw) return;
        const saved = JSON.parse(raw) as { amount?: string; currency?: string };
        if (typeof saved.amount === 'string') setSavingsInput(saved.amount);
        if (typeof saved.currency === 'string') setSavingsCurrency(saved.currency);
      } catch {}
    })();
  }, [vehicleId]);

  function updateSavingsInput(value: string) {
    setSavingsInput(value);
    try {
      localStorage.setItem(
        savingsStorageKey(vehicleId),
        JSON.stringify({ amount: value, currency: savingsCurrency })
      );
    } catch {}
  }

  function updateSavingsCurrency(value: string) {
    setSavingsCurrency(value);
    try {
      localStorage.setItem(
        savingsStorageKey(vehicleId),
        JSON.stringify({ amount: savingsInput, currency: value })
      );
    } catch {}
  }

  const savingsCurrencyOptions = useMemo(() => {
    const alt = currency === 'USD' ? localCurrency : 'USD';
    return Array.from(new Set([currency, alt]));
  }, [currency, localCurrency]);

  const rawSavings = Math.max(0, Number(savingsInput.replace(',', '.')) || 0);
  const monthlySavings = convertCurrency(rawSavings, savingsCurrency, currency, localCurrency, dollarRate);

  const data = useMemo(
    () => buildData(outstandingLoan, monthlyPayment, monthlySavings, remainingInstallments, capitalSchedule),
    [outstandingLoan, monthlyPayment, monthlySavings, remainingInstallments, capitalSchedule]
  );
  const crossoverMonth = useMemo(() => findCrossoverMonth(data), [data]);
  const sampled = useMemo(
    () => sampleMonths(data, remainingInstallments, crossoverMonth),
    [data, remainingInstallments, crossoverMonth]
  );

  if (outstandingLoan <= 0 || monthlyPayment <= 0 || remainingInstallments <= 0) return null;

  const fmt = (n: number) => formatMoney(n, currency, locale);
  const now = new Date();
  const baseMonth = now.getMonth() + 1;
  const baseYear = now.getFullYear();
  const dateFor = (offset: number) => addMonthsLabel(baseMonth, baseYear, offset);
  const dateForShort = (offset: number) => addMonthsShortLabel(baseMonth, baseYear, offset);

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
                onChange={(e) => updateSavingsInput(e.target.value)}
                className="w-40 tabular-nums"
              />
              {savingsCurrencyOptions.length > 1 ? (
                <Select value={savingsCurrency} onValueChange={updateSavingsCurrency}>
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
              Ahorrando {fmt(monthlySavings)} por mes, en el{' '}
              <strong>
                mes {crossoverMonth} ({dateFor(crossoverMonth)})
              </strong>{' '}
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

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: DEBT_COLOR }} />
            <span className="text-muted-foreground">Saldo del préstamo</span>
          </span>
          {capitalSchedule && (
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: CAPITAL_COLOR }} />
              <span className="text-muted-foreground">Capital pendiente</span>
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: SAVINGS_COLOR }} />
            <span className="text-muted-foreground">Tu ahorro</span>
          </span>
        </div>

        <div className="h-[280px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={sampled} margin={{ top: 28, right: 16, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(m: number) => `Mes ${m}`}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={56}
                domain={[0, (max: number) => Math.ceil((max * 1.15) / 1000) * 1000]}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                content={(props) => (
                  <ChartTooltipContent
                    {...props}
                    crossoverMonth={crossoverMonth}
                    currency={currency}
                    locale={locale}
                    baseMonth={baseMonth}
                    baseYear={baseYear}
                  />
                )}
              />
              <Bar dataKey="deuda" name="Deuda" stackId="s" radius={[0, 0, 6, 6]} isAnimationActive={false}>
                {sampled.map((row) => (
                  <Cell
                    key={row.month}
                    fill={DEBT_COLOR}
                    fillOpacity={row.month === crossoverMonth ? 1 : 0.75}
                    stroke={row.month === crossoverMonth ? SAVINGS_COLOR : 'transparent'}
                    strokeWidth={row.month === crossoverMonth ? 1.5 : 0}
                  />
                ))}
              </Bar>
              <Bar dataKey="ahorro" name="Ahorro" stackId="s" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {sampled.map((row) => (
                  <Cell
                    key={row.month}
                    fill={SAVINGS_COLOR}
                    fillOpacity={row.month === crossoverMonth ? 1 : 0.75}
                    stroke={row.month === crossoverMonth ? SAVINGS_COLOR : 'transparent'}
                    strokeWidth={row.month === crossoverMonth ? 1.5 : 0}
                  />
                ))}
                <LabelList
                  dataKey="month"
                  content={(props) => (
                    <CrossoverBarBadge
                      x={props.x as number | undefined}
                      y={props.y as number | undefined}
                      width={props.width as number | undefined}
                      value={props.value}
                      crossoverMonth={crossoverMonth}
                    />
                  )}
                />
              </Bar>
              {capitalSchedule && (
                <Line
                  dataKey="capital"
                  stroke={CAPITAL_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CAPITAL_COLOR, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-xs">
            <thead>
              <tr>
                <th className="text-muted-foreground w-24 py-1.5 pr-2 text-left font-normal">Mes</th>
                {sampled.map((row) => (
                  <th
                    key={row.month}
                    className="rounded-t-md px-2 py-1.5 text-center font-medium tabular-nums"
                    style={
                      row.month === crossoverMonth
                        ? { color: SAVINGS_COLOR, backgroundColor: `${SAVINGS_COLOR}1a` }
                        : undefined
                    }
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{row.month}</span>
                      <span className="text-muted-foreground text-[10px] font-normal whitespace-nowrap">
                        {dateForShort(row.month)}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="text-muted-foreground py-1.5 pr-2">Préstamo</td>
                {sampled.map((row) => (
                  <td
                    key={row.month}
                    className="px-2 py-1.5 text-center tabular-nums"
                    style={{
                      color: DEBT_COLOR,
                      backgroundColor: row.month === crossoverMonth ? `${SAVINGS_COLOR}1a` : undefined,
                    }}
                  >
                    {fmt(row.deuda)}
                  </td>
                ))}
              </tr>
              {capitalSchedule && (
                <tr className="border-t">
                  <td className="text-muted-foreground py-1.5 pr-2">Capital</td>
                  {sampled.map((row) => (
                    <td
                      key={row.month}
                      className="px-2 py-1.5 text-center tabular-nums"
                      style={{
                        color: CAPITAL_COLOR,
                        backgroundColor: row.month === crossoverMonth ? `${SAVINGS_COLOR}1a` : undefined,
                      }}
                    >
                      {row.capital != null ? fmt(row.capital) : '—'}
                    </td>
                  ))}
                </tr>
              )}
              <tr className="border-t">
                <td className="text-muted-foreground py-1.5 pr-2">Ahorro</td>
                {sampled.map((row) => (
                  <td
                    key={row.month}
                    className="rounded-b-md px-2 py-1.5 text-center tabular-nums"
                    style={{
                      color: SAVINGS_COLOR,
                      backgroundColor: row.month === crossoverMonth ? `${SAVINGS_COLOR}1a` : undefined,
                    }}
                  >
                    {fmt(row.ahorro)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
