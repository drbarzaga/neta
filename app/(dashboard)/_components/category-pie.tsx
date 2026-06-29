'use client';

import { Pie, PieChart, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatMoney } from '@/lib/money';
import { useAnimations } from '@/components/animations-provider';

export interface PieDatum {
  name: string;
  value: number;
  color: string;
  icon?: string;
}

export function CategoryPie({
  data,
  currency = 'UYU',
  locale = 'es-UY',
}: {
  data: PieDatum[];
  currency?: string;
  locale?: string;
}) {
  const animations = useAnimations();
  const config: ChartConfig = Object.fromEntries(
    data.map((d) => [d.name, { label: d.name, color: d.color }])
  );

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        Sin gastos cargados todavía.
      </p>
    );
  }

  return (
    <ChartContainer config={config} className="mx-auto aspect-square max-h-[240px]">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, name) => (
                <div className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(Number(value), currency, locale)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          strokeWidth={2}
          isAnimationActive={animations}
          animationDuration={550}
          animationEasing="ease-out"
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
