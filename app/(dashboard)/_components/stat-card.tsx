import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StatAccent = 'primary' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet';

const ACCENTS: Record<StatAccent, string> = {
  primary: 'bg-primary/10 text-primary',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
};

export function StatCard({
  label,
  value,
  sub,
  valueClass,
  icon,
  accent = 'primary',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  valueClass?: string;
  icon?: React.ReactNode;
  accent?: StatAccent;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm font-medium">{label}</p>
          {icon ? (
            <div
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl',
                ACCENTS[accent]
              )}
            >
              {icon}
            </div>
          ) : null}
        </div>
        <div>
          <p className={cn('text-3xl font-semibold tracking-tight tabular-nums', valueClass)}>
            {value}
          </p>
          {sub ? (
            <p className="text-muted-foreground mt-1 text-sm tabular-nums">{sub}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
