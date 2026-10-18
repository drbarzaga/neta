'use client';

import { useTransition } from 'react';
import { RiCheckLine } from '@remixicon/react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Vincular a cuota de auto</DialogTitle>
          <DialogDescription>
            Elegí qué cuota paga este gasto. Las cuotas ya vinculadas a otro gasto no se pueden
            elegir.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => link(null)}
            className={cn(
              'hover:bg-muted flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm disabled:opacity-50',
              currentInstallmentId === null && 'bg-muted font-medium'
            )}
          >
            Ninguna
            {currentInstallmentId === null && <RiCheckLine className="size-4 shrink-0" />}
          </button>

          {installments.length === 0 && (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              No tenés cuotas de préstamo cargadas en Auto.
            </p>
          )}

          {installments.map((inst) => {
            const lockedByOther = inst.linkedExpenseId !== null && inst.linkedExpenseId !== expenseId;
            const selected = inst.id === currentInstallmentId;
            return (
              <button
                key={inst.id}
                type="button"
                disabled={pending || lockedByOther}
                onClick={() => link(inst.id)}
                className={cn(
                  'hover:bg-muted flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
                  selected && 'bg-muted font-medium'
                )}
              >
                <div className="min-w-0">
                  <p className="truncate">
                    {inst.vehicleName} — {inst.concept}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {MONTHS_ES[inst.month - 1]} {inst.year} ·{' '}
                    {formatMoney(inst.amount, inst.currency)}
                    {lockedByOther
                      ? ` · vinculada a "${inst.linkedExpenseConcept}"`
                      : inst.paid
                        ? ' · pagada'
                        : ''}
                  </p>
                </div>
                {selected && <RiCheckLine className="size-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
