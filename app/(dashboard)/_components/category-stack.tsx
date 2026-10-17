import { CategoryIcon } from '@/components/category-icon';
import { formatMoney } from '@/lib/money';
import type { PieDatum } from './category-pie';

/** Pila de categorías: barra horizontal segmentada + leyenda con % y monto. */
export function CategoryStack({
  data,
  currency = 'UYU',
  locale = 'es-UY',
}: {
  data: PieDatum[];
  currency?: string;
  locale?: string;
}) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-(--ink-3)">Sin gastos cargados todavía.</p>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-(--line)">
        {data.map((d) => (
          <div
            key={d.name}
            style={{ width: `${total > 0 ? (d.value / total) * 100 : 0}%`, backgroundColor: d.color }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {data.map((d) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <div
              key={d.name}
              className="flex items-center justify-between gap-3 border-t border-(--line) py-3.5 first:border-t-0"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${d.color}26`, color: d.color }}
                >
                  <CategoryIcon name={d.icon} className="size-4" />
                </span>
                <span className="truncate text-sm">{d.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3 font-mono text-xs tabular-nums">
                <span className="text-(--ink-3)">{pct.toFixed(0)}%</span>
                <span className="w-20 text-right font-medium text-foreground">
                  {formatMoney(d.value, currency, locale)}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
