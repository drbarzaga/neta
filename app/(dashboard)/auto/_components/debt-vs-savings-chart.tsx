'use client';

import { useMemo } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/lib/money';

const DEBT_COLOR = '#ef4444';
const SAVINGS_COLOR = '#10b981';

export interface DebtAnchor {
  month: number;
  deuda: number;
}

interface ChartRow {
  month: number;
  deuda: number;
  ahorro: number;
}

// Puntos de control reales de la amortización (no es un decremento lineal:
// la cuota fija cubre interés + capital, así que la deuda baja cada vez más
// rápido). El resto de los meses se interpola entre estos.
const DEFAULT_ANCHORS: DebtAnchor[] = [
  { month: 0, deuda: 288337 },
  { month: 3, deuda: 258115 },
  { month: 6, deuda: 226702 },
  { month: 9, deuda: 193916 },
  { month: 10, deuda: 182491 },
  { month: 14, deuda: 134767 },
  { month: 24, deuda: 0 },
];

function interpolateDebt(anchors: DebtAnchor[], month: number): number {
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (month >= a.month && month <= b.month) {
      const t = (month - a.month) / (b.month - a.month);
      return a.deuda + (b.deuda - a.deuda) * t;
    }
  }
  return anchors[anchors.length - 1].deuda;
}

function buildData(anchors: DebtAnchor[], monthlySavings: number, months: number): ChartRow[] {
  return Array.from({ length: months + 1 }, (_, month) => ({
    month,
    deuda: Math.round(interpolateDebt(anchors, month)),
    ahorro: Math.round(monthlySavings * month),
  }));
}

/** Primer mes en que el ahorro acumulado alcanza o supera el saldo pendiente. */
function findCrossoverMonth(data: ChartRow[]): number | null {
  return data.find((row) => row.ahorro >= row.deuda)?.month ?? null;
}

function ChartTooltipContent({
  active,
  payload,
  crossoverMonth,
  locale,
}: TooltipContentProps & { crossoverMonth: number | null; locale: string }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ChartRow;
  const readyForPayoff = crossoverMonth !== null && row.month >= crossoverMonth;

  return (
    <div className="bg-popover min-w-40 rounded-lg border px-3 py-2 text-xs shadow-xl">
      <p className="mb-1.5 font-medium">Mes {row.month}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Deuda</span>
        <span className="font-medium tabular-nums" style={{ color: DEBT_COLOR }}>
          {formatMoney(row.deuda, 'UYU', locale)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Ahorro</span>
        <span className="font-medium tabular-nums" style={{ color: SAVINGS_COLOR }}>
          {formatMoney(row.ahorro, 'UYU', locale)}
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

export function DebtVsSavingsChart({
  anchors = DEFAULT_ANCHORS,
  monthlySavings = 20625,
  months = 24,
  locale = 'es-UY',
  vehicleName = 'tu auto',
}: {
  anchors?: DebtAnchor[];
  monthlySavings?: number;
  months?: number;
  locale?: string;
  vehicleName?: string;
}) {
  const data = useMemo(() => buildData(anchors, monthlySavings, months), [anchors, monthlySavings, months]);
  const crossoverMonth = useMemo(() => findCrossoverMonth(data), [data]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">Ahorro vs. deuda — cancelación anticipada</CardTitle>
        <CardDescription>
          Proyección ilustrativa a {months} meses de {vehicleName}: cuándo el fondo de ahorro
          supera el saldo pendiente del préstamo y se puede cancelar a sola firma.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[320px] px-2 sm:px-4">
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
              interval={2}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={56}
              tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border)' }}
              content={(props) => (
                <ChartTooltipContent {...props} crossoverMonth={crossoverMonth} locale={locale} />
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
      </CardContent>
    </Card>
  );
}
