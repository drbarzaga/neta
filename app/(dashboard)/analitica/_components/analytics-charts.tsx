'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatMoney } from '@/lib/money';
import { useAnimations } from '@/components/animations-provider';

export interface MonthlyRow {
  label: string;
  pagado: number;
  pendiente: number;
  [category: string]: number | string;
}

export interface CategoryMeta {
  name: string;
  color: string;
}

function moneyFormatter(
  value: unknown,
  name: unknown,
  config: ChartConfig,
  currency: string,
  locale: string
) {
  return (
    <div className="flex w-full justify-between gap-4">
      <span className="text-muted-foreground">
        {config[name as string]?.label ?? (name as string)}
      </span>
      <span className="font-medium tabular-nums">
        {formatMoney(Number(value), currency, locale)}
      </span>
    </div>
  );
}

export function CategoryAreaChart({
  data,
  categories,
  currency = 'UYU',
  locale = 'es-UY',
}: {
  data: MonthlyRow[];
  categories: CategoryMeta[];
  currency?: string;
  locale?: string;
}) {
  const animations = useAnimations();
  const config: ChartConfig = Object.fromEntries(
    categories.map((c) => [c.name, { label: c.name, color: c.color }])
  );

  // Con pocos meses el área queda con puntos sueltos; usamos barras apiladas.
  const useArea = data.length >= 3;

  return (
    <ChartContainer config={config} className="max-h-[300px] w-full">
      {useArea ? (
        <AreaChart data={data} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip
            content={<ChartTooltipContent formatter={(v, n) => moneyFormatter(v, n, config, currency, locale)} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          {categories.map((c) => (
            <Area
              key={c.name}
              dataKey={c.name}
              type="monotone"
              stackId="cat"
              stroke={c.color}
              fill={c.color}
              fillOpacity={0.35}
              isAnimationActive={animations}
              animationDuration={550}
              animationEasing="ease-out"
            />
          ))}
        </AreaChart>
      ) : (
        <BarChart data={data} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip
            content={<ChartTooltipContent formatter={(v, n) => moneyFormatter(v, n, config, currency, locale)} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          {categories.map((c, i) => (
            <Bar
              key={c.name}
              dataKey={c.name}
              stackId="cat"
              fill={c.color}
              maxBarSize={64}
              isAnimationActive={animations}
              animationDuration={550}
              animationEasing="ease-out"
              radius={i === categories.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      )}
    </ChartContainer>
  );
}

const statusConfig: ChartConfig = {
  pagado: { label: 'Pagado', color: 'var(--chart-1)' },
  pendiente: { label: 'Pendiente', color: 'var(--chart-3)' },
};

export function StatusBarChart({
  data,
  currency = 'UYU',
  locale = 'es-UY',
}: {
  data: MonthlyRow[];
  currency?: string;
  locale?: string;
}) {
  const animations = useAnimations();
  return (
    <ChartContainer config={statusConfig} className="max-h-[300px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip
          content={
            <ChartTooltipContent formatter={(v, n) => moneyFormatter(v, n, statusConfig, currency, locale)} />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="pagado" stackId="s" fill="var(--color-pagado)" maxBarSize={64} radius={[0, 0, 6, 6]} isAnimationActive={animations} animationDuration={550} animationEasing="ease-out" />
        <Bar dataKey="pendiente" stackId="s" fill="var(--color-pendiente)" maxBarSize={64} radius={[6, 6, 0, 0]} isAnimationActive={animations} animationDuration={550} animationEasing="ease-out" />
      </BarChart>
    </ChartContainer>
  );
}
