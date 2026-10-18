import { pgTable, uuid, text, numeric, integer, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { savingsAccount } from './savings';

export const salaryDepositDayMode = pgEnum('salary_deposit_day_mode', [
  'first_business_day',
  'fixed_day',
]);

// Depósito automático del sueldo, una fila por usuario. Un cron diario
// (lib/notifications.ts -> runSalaryDeposits) revisa todas las filas
// habilitadas y acredita el monto en el apartado elegido el día que
// corresponda, una sola vez por mes (lastRunYear/lastRunMonth).
export const salaryDeposit = pgTable('salary_deposit', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  enabled: boolean().notNull().default(false),
  accountId: uuid().references(() => savingsAccount.id, { onDelete: 'set null' }),
  amount: numeric({ precision: 14, scale: 2, mode: 'number' }).notNull().default(0),
  currency: text().notNull().default('UYU'),
  dayMode: salaryDepositDayMode().notNull().default('first_business_day'),
  fixedDay: integer().notNull().default(1), // 1-31, solo aplica con dayMode='fixed_day'
  lastRunYear: integer(),
  lastRunMonth: integer(),
  lastRunAt: timestamp(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export type SalaryDeposit = typeof salaryDeposit.$inferSelect;
