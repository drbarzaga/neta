'use client';

import { useAnimations } from '@/components/animations-provider';
import { PageTransition } from '@/components/page-transition';

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const animations = useAnimations();
  return animations ? <PageTransition>{children}</PageTransition> : children;
}
