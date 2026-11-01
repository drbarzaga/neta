import { Skeleton } from '@/components/ui/skeleton';

/** Silueta del dashboard: conserva su forma mientras llegan los datos. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando resumen">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-2 h-[46px] w-56" />
        </div>
        <Skeleton className="h-11 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-[84px] rounded-xl" />
      <Skeleton className="h-[84px] rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-[340px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[340px] rounded-xl lg:col-span-3" />
      </div>
    </div>
  );
}
