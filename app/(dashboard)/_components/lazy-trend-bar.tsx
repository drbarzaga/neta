'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/chart-skeleton';

export const LazyTrendBar = dynamic(() => import('./trend-bar').then((m) => m.TrendBar), {
  ssr: false,
  loading: () => <ChartSkeleton className="h-[260px]" />,
});
