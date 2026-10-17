import 'server-only';
import {
  db,
  eq,
  asc,
  vehicle,
  vehicleExpense,
  type Vehicle,
  type VehicleExpense,
} from '@/db';
import { LOAN_INSTALLMENT_CATEGORY } from './schema';

export interface VehicleTotals {
  paidUsd: number;
  pendingUsd: number;
  totalUsd: number;
  loanPaidUsd: number;
  loanPendingUsd: number;
  otherPaidUsd: number;
  otherPendingUsd: number;
  installmentsPaid: number;
  installmentsTotal: number;
}

export interface VehicleWithExpenses extends Vehicle {
  expenses: VehicleExpense[];
  totals: VehicleTotals;
}

/** Convierte un importe a USD: 1:1 si ya está en USD, o vía la cotización local. */
function toUsdAmount(
  amount: number,
  currency: string,
  localCurrency: string,
  rate: number
): number {
  if (currency === 'USD') return amount;
  if (currency === localCurrency && rate > 0) return amount / rate;
  return amount;
}

/** Vehículos del usuario con sus gastos y totales, por fecha de creación. */
export async function getVehicles(
  userId: string,
  localCurrency: string
): Promise<VehicleWithExpenses[]> {
  const [vehicles, allExpenses] = await Promise.all([
    db
      .select()
      .from(vehicle)
      .where(eq(vehicle.userId, userId))
      .orderBy(asc(vehicle.createdAt)),
    db.select().from(vehicleExpense).where(eq(vehicleExpense.userId, userId)),
  ]);

  const byVehicle = new Map<string, VehicleExpense[]>();
  for (const e of allExpenses) {
    if (!byVehicle.has(e.vehicleId)) byVehicle.set(e.vehicleId, []);
    byVehicle.get(e.vehicleId)!.push(e);
  }

  return vehicles.map((v) => {
    const expenses = (byVehicle.get(v.id) ?? []).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      return a.sortOrder - b.sortOrder;
    });

    let paidUsd = 0;
    let pendingUsd = 0;
    let loanPaidUsd = 0;
    let loanPendingUsd = 0;
    let otherPaidUsd = 0;
    let otherPendingUsd = 0;
    let installmentsPaid = 0;
    let installmentsTotal = 0;
    for (const e of expenses) {
      const usd = toUsdAmount(e.amount, e.currency, localCurrency, v.dollarRate);
      const isLoan = e.category === LOAN_INSTALLMENT_CATEGORY;
      if (e.paid) {
        paidUsd += usd;
        if (isLoan) loanPaidUsd += usd;
        else otherPaidUsd += usd;
      } else {
        pendingUsd += usd;
        if (isLoan) loanPendingUsd += usd;
        else otherPendingUsd += usd;
      }
      if (isLoan) {
        installmentsTotal++;
        if (e.paid) installmentsPaid++;
      }
    }

    return {
      ...v,
      expenses,
      totals: {
        paidUsd,
        pendingUsd,
        totalUsd: paidUsd + pendingUsd,
        loanPaidUsd,
        loanPendingUsd,
        otherPaidUsd,
        otherPendingUsd,
        installmentsPaid,
        installmentsTotal,
      },
    };
  });
}
