'use client';

import { Line, LineChart, CartesianGrid, XAxis } from 'recharts';
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

export interface TrendDatum {
  label: string;
  utilizado: number;
  ingreso: number;
}

const config: ChartConfig = {
  ingreso: { label: 'Ingreso', color: 'var(--ink-3)' },
  utilizado: { label: 'Utilizado', color: 'var(--chart-1)' },
};

export function TrendBar({
  data,
  currency = 'UYU',
  locale = 'es-UY',
}: {
  data: TrendDatum[];
  currency?: string;
  locale?: string;
}) {
  const animations = useAnimations();
  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        Necesitas al menos un mes con datos.
      </p>
    );
  }

  return (
    <ChartContainer config={config} className="max-h-[260px] w-full">
      <LineChart data={data} accessibilityLayer margin={{ top: 12, right: 12, left: 12 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, fill: 'var(--ink-3)' }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">
                    {config[name as keyof typeof config]?.label ?? name}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(Number(value), currency, locale)}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="ingreso"
          stroke="var(--color-ingreso)"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          isAnimationActive={animations}
          animationDuration={550}
          animationEasing="ease-out"
        />
        <Line
          dataKey="utilizado"
          stroke="var(--color-utilizado)"
          strokeWidth={3}
          dot={{ r: 5, fill: 'var(--color-utilizado)', strokeWidth: 0 }}
          activeDot={{ r: 6 }}
          isAnimationActive={animations}
          animationDuration={550}
          animationEasing="ease-out"
        />
      </LineChart>
    </ChartContainer>
  );
}
