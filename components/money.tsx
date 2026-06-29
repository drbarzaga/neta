'use client';

import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { currencyDecimals } from '@/lib/countries';
import { useAnimations } from '@/components/animations-provider';

const DEFAULT_LOCALE = 'es-UY';

// Curva rápida y decelerada (ease-out) en vez del spring lento por defecto:
// el count-up arranca veloz y se siente ágil.
const TIMING = { duration: 450, easing: 'ease-out' } as const;

/** Importe monetario animado (NumberFlow), para cualquier moneda ISO. */
export function Money({
  value,
  currency = 'UYU',
  locale = DEFAULT_LOCALE,
  className,
  animateOnMount = false,
}: {
  value: number;
  currency?: string;
  locale?: string;
  className?: string;
  animateOnMount?: boolean;
}) {
  const animations = useAnimations();
  const countUp = animateOnMount && animations;
  const [shown, setShown] = useState(countUp ? 0 : value);
  useEffect(() => {
    if (!countUp) return;
    const apply = () => setShown(value);
    const id = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(id);
  }, [value, countUp]);

  return (
    <NumberFlow
      value={countUp ? shown : value}
      animated={animations}
      className={className}
      locales={locale}
      transformTiming={TIMING}
      spinTiming={TIMING}
      format={{
        style: 'currency',
        currency,
        maximumFractionDigits: currencyDecimals(currency),
      }}
    />
  );
}

/** Porcentaje animado (NumberFlow). */
export function Pct({
  value,
  className,
  animateOnMount = false,
}: {
  value: number;
  className?: string;
  animateOnMount?: boolean;
}) {
  const animations = useAnimations();
  const countUp = animateOnMount && animations;
  const [shown, setShown] = useState(countUp ? 0 : value);
  useEffect(() => {
    if (!countUp) return;
    const apply = () => setShown(value);
    const id = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(id);
  }, [value, countUp]);

  return (
    <NumberFlow
      value={countUp ? shown : value}
      animated={animations}
      className={className}
      locales={DEFAULT_LOCALE}
      transformTiming={TIMING}
      spinTiming={TIMING}
      suffix="%"
      format={{ maximumFractionDigits: 1 }}
    />
  );
}
