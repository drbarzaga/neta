import { RiLoader4Line } from '@remixicon/react';

export default function DashboardLoading() {
  return (
    <div className="text-muted-foreground flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <RiLoader4Line className="size-8 animate-spin" />
      <p className="text-sm">Cargando…</p>
    </div>
  );
}
