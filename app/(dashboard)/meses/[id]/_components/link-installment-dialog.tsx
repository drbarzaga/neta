'use client';

import { useTransition } from 'react';
import { RiCheckLine, RiCarLine, RiCloseCircleLine, RiLockLine } from '@remixicon/react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { MONTHS_ES } from '@/lib/dates';
import type { VehicleInstallmentOption } from '../../../auto/queries';
import { setExpenseVehicleInstallment } from '../actions';

export function LinkInstallmentDialog({
  open,
  onOpenChange,
  expenseId,
  currentInstallmentId,
  installments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string;
  currentInstallmentId: string | null;
  installments: VehicleInstallmentOption[];
}) {
  const [pending, startTransition] = useTransition();

  function link(vehicleExpenseId: string | null) {
    if (vehicleExpenseId === currentInstallmentId) {
      onOpenChange(false);
      return;
    }
    startTransition(async () => {
      const res = await setExpenseVehicleInstallment({ id: expenseId, vehicleExpenseId });
      if (!res.ok) {
        toast.error(res.error ?? 'Error al vincular');
        return;
      }
      toast.success(vehicleExpenseId ? 'Gasto vinculado a la cuota' : 'Gasto desvinculado');
      onOpenChange(false);
    });
  }

  const noneSelected = currentInstallmentId === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>Vincular a cuota de auto</DialogTitle>
          <DialogDescription>
            Elegí qué cuota paga este gasto. Las que ya están vinculadas a otro gasto aparecen
            bloqueadas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <button
            type="button"
            disabled={pending}
            onClick={() => link(null)}
            className={cn(
              'mb-4 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50',
              noneSelected
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/60 hover:border-muted-foreground/30'
            )}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                noneSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              <RiCloseCircleLine className="size-5" />
            </span>
            <span className="flex-1 text-sm font-medium">Sin vincular</span>
            {noneSelected && <RiCheckLine className="text-primary size-4 shrink-0" />}
          </button>

          {installments.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              No tenés cuotas de préstamo cargadas en Auto.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {installments.map((inst) => {
                const lockedByOther =
                  inst.linkedExpenseId !== null && inst.linkedExpenseId !== expenseId;
                const selected = inst.id === currentInstallmentId;
                return (
                  <button
                    key={inst.id}
                    type="button"
                    disabled={pending || lockedByOther}
                    onClick={() => link(inst.id)}
                    className={cn(
                      'group relative flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-colors',
                      selected && 'border-primary bg-primary/5',
                      !selected &&
                        !lockedByOther &&
                        'hover:bg-muted/60 hover:border-muted-foreground/30',
                      lockedByOther && 'bg-muted/30 cursor-not-allowed opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-lg',
                          selected
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {lockedByOther ? (
                          <RiLockLine className="size-4" />
                        ) : (
                          <RiCarLine className="size-4" />
                        )}
                      </span>
                      {selected && <RiCheckLine className="text-primary size-4 shrink-0" />}
                      {inst.paid && !lockedByOther && !selected && (
                        <Badge variant="secondary" className="shrink-0">
                          Pagada
                        </Badge>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{inst.vehicleName}</p>
                      <p className="text-muted-foreground truncate text-xs">{inst.concept}</p>
                      <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                        {MONTHS_ES[inst.month - 1]} {inst.year} ·{' '}
                        {formatMoney(inst.amount, inst.currency)}
                      </p>
                    </div>
                    {lockedByOther && (
                      <p className="text-muted-foreground truncate text-[11px]">
                        Vinculada a &quot;{inst.linkedExpenseConcept}&quot;
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
