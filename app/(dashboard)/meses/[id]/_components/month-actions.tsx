'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  FileText,
  Copy,
  CopyPlus,
  Lock,
  LockOpen,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirm } from '@/components/confirm-provider';
import { duplicatePeriod, setPeriodStatus, deletePeriod } from '../../actions';

export function MonthActions({
  periodId,
  label,
  status,
}: {
  periodId: string;
  label: string;
  status: 'open' | 'closed';
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  function run(
    fn: () => Promise<{ ok: boolean; error?: string; data?: { id: string } }>,
    success: string,
    onOk?: (data?: { id: string }) => void
  ) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? 'Error');
        return;
      }
      toast.success(success);
      onOk?.(res.data);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={pending}>
          Acciones <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <a
            href={`/api/meses/${periodId}/pdf`}
            target="_blank"
            rel="noreferrer"
          >
            <FileText className="size-4" /> Exportar PDF
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            run(
              () => duplicatePeriod(periodId),
              'Mes duplicado al siguiente período',
              (data) => data?.id && router.push(`/meses/${data.id}`)
            )
          }
        >
          <Copy className="size-4" /> Duplicar al mes siguiente
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            run(
              () => duplicatePeriod(periodId, true),
              'Mes duplicado con montos en $0',
              (data) => data?.id && router.push(`/meses/${data.id}`)
            )
          }
        >
          <CopyPlus className="size-4" /> Duplicar al siguiente (montos en $0)
        </DropdownMenuItem>
        {status === 'open' ? (
          <DropdownMenuItem
            onClick={() => run(() => setPeriodStatus(periodId, 'closed'), 'Mes cerrado')}
          >
            <Lock className="size-4" /> Cerrar mes
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => run(() => setPeriodStatus(periodId, 'open'), 'Mes reabierto')}
          >
            <LockOpen className="size-4" /> Reabrir mes
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            const ok = await confirm({
              title: 'Eliminar mes',
              description: `Se eliminará "${label}" y todos sus gastos. Esta acción no se puede deshacer.`,
              confirmText: 'Eliminar',
              destructive: true,
            });
            if (ok)
              run(() => deletePeriod(periodId), 'Mes eliminado', () =>
                router.push('/meses')
              );
          }}
        >
          <Trash2 className="size-4" /> Eliminar mes
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
