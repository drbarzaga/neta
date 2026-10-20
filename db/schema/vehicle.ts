import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

export const vehicleStatus = pgEnum('vehicle_status', [
  'ahorrando',
  'financiando',
  'pagado',
]);

// Vehículo en compra/financiación (ej. auto nuevo). Centraliza precio, inicial
// y préstamo; sus gastos mes a mes (cuotas, seguro, mantenimiento…) viven en
// `vehicleExpense`.
export const vehicle = pgTable('vehicle', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text().notNull(), // ej. "VW Tera"
  version: text(), // ej. "High"
  year: integer(),
  imageUrl: text(), // foto real del auto (URL pegada a mano), opcional
  totalPrice: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),
  downPaymentTarget: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),
  downPaymentSaved: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),
  loanAmount: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),
  loanMonths: integer().notNull().default(0),
  loanStartMonth: integer().notNull().default(1), // 1-12
  loanStartYear: integer().notNull().default(2026),
  monthlyPayment: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),
  currency: text().notNull().default('USD'), // ISO-4217 (moneda del precio/préstamo)
  monthlyPaymentCurrency: text().notNull().default('USD'), // ISO-4217 (moneda de la cuota, puede diferir de `currency`)
  dollarRate: numeric({ precision: 14, scale: 4, mode: 'number' })
    .notNull()
    .default(0), // moneda local por 1 USD, para convertir gastos en moneda local
  status: vehicleStatus().notNull().default('financiando'),
  color: text().notNull().default('#2563eb'),
  // Préstamo indexado a la Unidad Indexada (UI, Uruguay): la cuota es fija en
  // UI y se paga en pesos al valor del día. `monthlyPayment`/`currency`
  // siguen reflejando el estimado en pesos (recalculado vía `lib/ui-value.ts`).
  loanUnit: text().notNull().default('currency'), // 'currency' | 'ui'
  monthlyPaymentUi: numeric({ precision: 14, scale: 4, mode: 'number' })
    .notNull()
    .default(0), // cuota fija en UI (capital+interés+IVA+seguro de vida+tasas)
  uiRateAtOrigination: numeric({ precision: 10, scale: 4, mode: 'number' })
    .notNull()
    .default(0), // cotización de la UI el día de la liquidación (solo referencia)
  createdAt: timestamp().notNull().defaultNow(),
});

export type Vehicle = typeof vehicle.$inferSelect;
