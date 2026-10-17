import { cn } from '@/lib/utils';

/** Grilla de cuotas de un préstamo: un segmento por cuota, pagadas en forest. */
export function InstallmentGrid({
  paid,
  className,
}: {
  /** Un booleano por cuota, en orden (true = pagada). */
  paid: boolean[];
  className?: string;
}) {
  if (paid.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {paid.map((isPaid, i) => (
        <div
          key={i}
          title={`Cuota ${i + 1}${isPaid ? ' — pagada' : ''}`}
          className={cn('h-[26px] w-3 rounded-[7px]', isPaid ? 'bg-[var(--forest)]' : 'bg-[#E6E9E0]')}
        />
      ))}
    </div>
  );
}
