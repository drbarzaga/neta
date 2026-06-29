'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAnimations } from '@/components/animations-provider';

export function ProgressRing({
  value,
  size = 72,
  strokeWidth = 8,
  className,
  trackClassName,
  indicatorClassName,
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
  /** @deprecated el barrido se controla con la preferencia global de animaciones. */
  animateOnMount?: boolean;
  children?: React.ReactNode;
}) {
  const animations = useAnimations();
  const [shown, setShown] = useState(animations ? 0 : value);
  useEffect(() => {
    if (!animations) return;
    // Doble rAF: pintamos el estado inicial (0) antes de pasar al valor, para
    // que la transición CSS del arco realmente ocurra.
    let inner = 0;
    const apply = () => setShown(value);
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(apply);
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [value, animations]);

  const clamped = Math.min(100, Math.max(0, shown));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={cn('fill-none stroke-muted', trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            'fill-none stroke-primary transition-[stroke-dashoffset] duration-500 ease-out',
            indicatorClassName
          )}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
