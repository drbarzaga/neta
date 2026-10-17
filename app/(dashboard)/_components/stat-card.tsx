import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatAccent = 'primary' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet';

const ACCENTS: Record<StatAccent, string> = {
  primary: 'bg-[var(--forest-soft)] text-[var(--forest)]',
  emerald: 'bg-[var(--forest-soft)] text-[var(--forest)]',
  sky: 'bg-[#EEF0EA] text-[var(--ink-2)] dark:bg-[var(--muted)]',
  amber: 'bg-[var(--amber-soft)] text-[var(--amber)]',
  rose: 'bg-[var(--coral-soft)] text-[var(--coral)]',
  violet: 'bg-[var(--coral-soft)] text-[var(--coral)]',
};

/** Indicador (KPI): etiqueta + ícono arriba, valor grande, subtexto en mono. */
export function StatCard({
  label,
  value,
  sub,
  valueClass,
  icon,
  accent = 'primary',
  variant = 'default',
  progress,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  valueClass?: string;
  icon?: React.ReactNode;
  accent?: StatAccent;
  /** 'forest' para destacar un indicador clave (ej. "Restante") con fondo sólido. */
  variant?: 'default' | 'forest';
  /** 0-100: si se pasa, dibuja una barra de progreso bajo el valor. */
  progress?: number;
}) {
  const forest = variant === 'forest';
  return (
    <Card variant={forest ? 'forest' : 'default'}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className={cn('text-sm font-medium', forest ? 'text-white/80' : 'text-[var(--ink-2)]')}>
            {label}
          </p>
          {icon ? (
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl',
                forest ? 'bg-white/15 text-white' : ACCENTS[accent]
              )}
            >
              {icon}
            </div>
          ) : null}
        </div>
        <div>
          <p
            className={cn(
              'font-heading text-[38px] leading-none font-bold tracking-tight tabular-nums [letter-spacing:-0.025em]',
              forest && 'text-white',
              valueClass
            )}
          >
            {value}
          </p>
          {progress !== undefined && (
            <div
              className={cn(
                'mt-3 h-2.5 w-full overflow-hidden rounded-full',
                forest ? 'bg-white/20' : 'bg-[#E6E9E0]'
              )}
            >
              <div
                className={cn('h-full rounded-full', forest ? 'bg-[var(--lime)]' : 'bg-[var(--forest)]')}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          )}
          {sub ? (
            <p
              className={cn(
                'mt-2 font-mono text-[13px] tabular-nums',
                forest ? 'text-white/70' : 'text-[var(--ink-3)]'
              )}
            >
              {sub}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
