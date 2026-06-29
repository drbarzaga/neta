'use client';

import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
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
  ingreso: { label: 'Ingreso', color: 'var(--chart-4)' },
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
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
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
        <Bar dataKey="ingreso" fill="var(--color-ingreso)" radius={6} maxBarSize={48} isAnimationActive={animations} animationDuration={550} animationEasing="ease-out" />
        <Bar dataKey="utilizado" fill="var(--color-utilizado)" radius={6} maxBarSize={48} isAnimationActive={animations} animationDuration={550} animationEasing="ease-out" />
      </BarChart>
    </ChartContainer>
  );
}
