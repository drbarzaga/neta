'use client';

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { useAnimations } from '@/components/animations-provider';

export function GoalChart({
  data,
  color,
  targetAmount,
  savedAmount,
  formatValue,
}: {
  data: { label: string; saved: number }[];
  color: string;
  targetAmount: number;
  savedAmount: number;
  formatValue: (value: number) => string;
}) {
  const animations = useAnimations();
  const chartConfig: ChartConfig = {
    saved: { label: 'Ahorrado', color },
  };

  return (
    <ChartContainer config={chartConfig} className="max-h-[260px] w-full">
      <AreaChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          hide
          domain={[0, Math.max(targetAmount, savedAmount)]}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="font-medium tabular-nums">
                  {formatValue(Number(value))}
                </span>
              )}
            />
          }
        />
        {targetAmount > 0 && (
          <ReferenceLine
            y={targetAmount}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{
              value: 'Objetivo',
              position: 'insideTopRight',
              fontSize: 10,
              fill: 'var(--muted-foreground)',
            }}
          />
        )}
        <Area
          dataKey="saved"
          type="monotone"
          stroke={color}
          fill={color}
          fillOpacity={0.2}
          isAnimationActive={animations}
          animationDuration={550}
        />
      </AreaChart>
    </ChartContainer>
  );
}
