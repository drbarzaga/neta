'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/chart-skeleton';

const loading = () => <ChartSkeleton className="h-[300px]" />;

export const LazyCategoryAreaChart = dynamic(
  () => import('./analytics-charts').then((m) => m.CategoryAreaChart),
  { ssr: false, loading }
);
export const LazyIncomeExpenseChart = dynamic(
  () => import('./analytics-charts').then((m) => m.IncomeExpenseChart),
  { ssr: false, loading }
);
export const LazyStatusBarChart = dynamic(
  () => import('./analytics-charts').then((m) => m.StatusBarChart),
  { ssr: false, loading }
);
