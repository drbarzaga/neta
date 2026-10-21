import 'server-only';
import { db, eq, and } from '@/db';
import { vehicleExpense } from '@/db/schema/vehicle-expense';
import { vehicle } from '@/db/schema/vehicle';
import { getLatestUiValue } from '@/lib/ui-value';
import { LOAN_INSTALLMENT_CATEGORY } from '@/app/(dashboard)/auto/schema';
import type { VehicleExpense } from '@/db';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Recalcula en pesos (`amount`) las cuotas no pagadas de préstamos indexados
 * a UI (las que tienen `amountUi` seteado), usando la UI vigente, y actualiza
 * `vehicle.monthlyPayment` de cada vehículo afectado para que el resumen de
 * `/auto` (cabecera, stat card, gráfico deuda-vs-ahorro) muestre el mismo
 * monto. Se llama al crear el préstamo y desde el cron diario que refresca
 * la UI. No toca cuotas ya pagadas (quedan con el monto que se depositó).
 */
export async function recalculateUiInstallments(vehicleId?: string): Promise<void> {
  const uiNow = await getLatestUiValue();

  const conditions = [eq(vehicleExpense.category, LOAN_INSTALLMENT_CATEGORY), eq(vehicleExpense.paid, false)];
  if (vehicleId) conditions.push(eq(vehicleExpense.vehicleId, vehicleId));

  const rows = await db
    .select({
      id: vehicleExpense.id,
      vehicleId: vehicleExpense.vehicleId,
      amountUi: vehicleExpense.amountUi,
      fixedSurchargeUyu: vehicleExpense.fixedSurchargeUyu,
    })
    .from(vehicleExpense)
    .where(and(...conditions));

  const latestAmountByVehicle = new Map<string, number>();

  for (const row of rows) {
    if (row.amountUi == null) continue;
    const amount = Math.round(row.amountUi * uiNow * 100) / 100 + (row.fixedSurchargeUyu ?? 0);
    await db.update(vehicleExpense).set({ amount }).where(eq(vehicleExpense.id, row.id));
    latestAmountByVehicle.set(row.vehicleId, amount);
  }

  for (const [vId, amount] of latestAmountByVehicle) {
    await db.update(vehicle).set({ monthlyPayment: amount }).where(eq(vehicle.id, vId));
  }
}

/**
 * Reconstruye el saldo de CAPITAL pendiente real (distinto del total de
 * cuotas que faltan pagar, que además suma interés, IVA, recargo fijo y
 * seguro) a partir del `capitalUi` de cada cuota no pagada, tomado del
 * cuadro de amortización real del banco. `schedule[0]` es el capital de hoy;
 * `schedule[n]` es el que queda tras pagarse las próximas `n` cuotas, en
 * orden cronológico. Convierte a moneda nativa con la UI de hoy (misma
 * simplificación que `recalculateUiInstallments`: no se proyecta la UI
 * futura). Devuelve `null` si falta el dato en alguna cuota no pagada, para
 * no inventar un número.
 */
export function buildCapitalSchedule(
  loanExpenses: Pick<VehicleExpense, 'paid' | 'capitalUi' | 'year' | 'month'>[],
  uiNow: number
): number[] | null {
  const unpaid = loanExpenses
    .filter((e) => !e.paid)
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  if (unpaid.length === 0 || unpaid.some((e) => e.capitalUi == null)) return null;

  let remainingUi = unpaid.reduce((sum, e) => sum + (e.capitalUi ?? 0), 0);
  const schedule = [round2(remainingUi * uiNow)];
  for (const e of unpaid) {
    remainingUi -= e.capitalUi ?? 0;
    schedule.push(round2(Math.max(0, remainingUi) * uiNow));
  }
  return schedule;
}
