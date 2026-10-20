import 'server-only';
import { db, eq, and } from '@/db';
import { vehicleExpense } from '@/db/schema/vehicle-expense';
import { vehicle } from '@/db/schema/vehicle';
import { getLatestUiValue } from '@/lib/ui-value';
import { LOAN_INSTALLMENT_CATEGORY } from '@/app/(dashboard)/auto/schema';

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
