'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const chartConfig: ChartConfig = {
  total: { label: 'Total ahorrado', color: 'var(--lime)' },
};

export function SavingsChart({
  data,
  formatValue,
}: {
  data: { label: string; total: number }[];
  formatValue: (value: number) => string;
}) {
  return (
    <ChartContainer config={chartConfig} className="max-h-[180px] w-full">
      <AreaChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,.12)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12, fill: 'rgba(255,255,255,.6)' }}
        />
        <YAxis hide domain={[0, 'dataMax']} />
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
        <Area
          dataKey="total"
          type="monotone"
          stroke="var(--lime)"
          fill="var(--lime)"
          fillOpacity={0.18}
          strokeWidth={2.5}
        />
      </AreaChart>
    </ChartContainer>
  );
}
