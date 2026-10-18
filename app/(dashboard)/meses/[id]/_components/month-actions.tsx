'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RiArrowDownSLine, RiFileTextLine, RiFileCopyLine, RiFileCopy2Line, RiLockLine, RiLockUnlockLine, RiEraserLine, RiDeleteBinLine } from '@remixicon/react';
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
import { clearPeriodExpenses } from '../actions';

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

  function run<T>(
    fn: () => Promise<{ ok: boolean; error?: string; data?: T }>,
    success: string | ((data?: T) => string),
    onOk?: (data?: T) => void
  ) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? 'Error');
        return;
      }
      toast.success(typeof success === 'function' ? success(res.data) : success);
      onOk?.(res.data);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={pending}>
          Acciones <RiArrowDownSLine />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <a
            href={`/api/meses/${periodId}/pdf`}
            target="_blank"
            rel="noreferrer"
          >
            <RiFileTextLine className="size-4" /> Exportar PDF
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
          <RiFileCopyLine className="size-4" /> Duplicar al mes siguiente
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
          <RiFileCopy2Line className="size-4" /> Duplicar sin montos ($0)
        </DropdownMenuItem>
        {status === 'open' ? (
          <DropdownMenuItem
            onClick={() => run(() => setPeriodStatus(periodId, 'closed'), 'Mes cerrado')}
          >
            <RiLockLine className="size-4" /> Cerrar mes
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => run(() => setPeriodStatus(periodId, 'open'), 'Mes reabierto')}
          >
            <RiLockUnlockLine className="size-4" /> Reabrir mes
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            const ok = await confirm({
              title: 'Vaciar mes',
              description: `Se eliminarán todos los gastos de "${label}", dejándolo limpio. El mes y su ingreso quedan como están. Esta acción no se puede deshacer.`,
              confirmText: 'Vaciar mes',
              destructive: true,
            });
            if (ok)
              run(
                () => clearPeriodExpenses(periodId),
                (data) =>
                  data && data.count > 0
                    ? `Se eliminaron ${data.count} gasto(s)`
                    : 'El mes ya estaba vacío'
              );
          }}
        >
          <RiEraserLine className="size-4" /> Vaciar mes
        </DropdownMenuItem>
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
          <RiDeleteBinLine className="size-4" /> Eliminar mes
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
