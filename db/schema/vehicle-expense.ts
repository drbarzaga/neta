import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  integer,
  date,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { vehicle } from './vehicle';

// Gasto mensual de un vehículo: cuota del préstamo (generada automáticamente
// al crear el plan) o un costo libre (seguro, patente, service, combustible…)
// agregado a mano. Se ubica por mes/año en vez de fecha exacta.
export const vehicleExpense = pgTable('vehicle_expense', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  vehicleId: uuid()
    .notNull()
    .references(() => vehicle.id, { onDelete: 'cascade' }),
  category: text().notNull().default('Otro'), // texto libre (Cuota préstamo, Seguro, Patente…)
  concept: text().notNull(),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' })
    .notNull()
    .default(0),
  currency: text().notNull().default('USD'), // ISO-4217 (moneda del vehículo o local)
  // Monto fijo en Unidad Indexada de esta cuota puntual (solo cuotas de
  // préstamos indexados, `vehicle.loanUnit === 'ui'`). Cuando está presente,
  // `amount` (pesos) se recalcula periódicamente a partir de este valor y la
  // UI vigente (ver `lib/vehicle-ui-loan.ts`), en vez de quedar fijo.
  amountUi: numeric({ precision: 14, scale: 4, mode: 'number' }),
  // Recargo fijo en pesos sumado al convertir `amountUi` a `amount` (ej. el
  // cargo fijo de $361 que BBVA debita junto con la cuota del préstamo UI,
  // además del monto indexado). No se indexa ni cambia con la UI.
  fixedSurchargeUyu: numeric({ precision: 14, scale: 2, mode: 'number' }),
  // Porción de capital (amortización) de esta cuota puntual, en Unidad
  // Indexada, tomada del cuadro de amortización real del banco (distinta de
  // `amountUi`, que es la cuota completa: capital + interés + IVA). Sirve
  // para reconstruir el saldo de capital pendiente real, mes a mes, sin
  // confundirlo con el total que se debita (ver `lib/vehicle-ui-loan.ts`).
  capitalUi: numeric({ precision: 14, scale: 4, mode: 'number' }),
  month: integer().notNull(), // 1-12
  year: integer().notNull(),
  // Fecha exacta de vencimiento (ej. día 5 de la cuota, fin de mes del
  // seguro), para mostrarla y para los recordatorios por email. Opcional:
  // los gastos libres agregados a mano pueden no tenerla.
  dueDate: date({ mode: 'string' }),
  paid: boolean().notNull().default(false),
  note: text(),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp().notNull().defaultNow(),
});

export type VehicleExpense = typeof vehicleExpense.$inferSelect;
