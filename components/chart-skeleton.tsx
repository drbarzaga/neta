import { cn } from '@/lib/utils';

/** Reserva el espacio de un gráfico mientras se descarga, para que nada salte. */
export function ChartSkeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('bg-muted/60 w-full animate-pulse rounded-lg', className)} />;
}
