import { z } from 'zod';

const currencyEnum = z.string().trim().toUpperCase().min(3).max(3);

// Sugerencias de categoría para gastos del vehículo (texto libre, no una tabla).
export const VEHICLE_EXPENSE_CATEGORIES = [
  'Cuota préstamo',
  'Seguro',
  'Patente',
  'Mantenimiento',
  'Combustible',
  'Otro',
] as const;

export const LOAN_INSTALLMENT_CATEGORY = 'Cuota préstamo';

export const vehicleStatusEnum = z.enum(['ahorrando', 'financiando', 'pagado']);

export const VEHICLE_STATUS_LABEL: Record<z.infer<typeof vehicleStatusEnum>, string> = {
  ahorrando: 'Ahorrando el inicial',
  financiando: 'Financiando',
  pagado: 'Pagado',
};

export const createVehicleSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre al vehículo').max(120),
  version: z.string().trim().max(60).nullable().optional(),
  year: z.number().int().min(1990).max(2100).nullable().optional(),
  imageUrl: z.url().max(500).nullable().optional(),
  totalPrice: z.number().min(0).default(0),
  downPaymentTarget: z.number().min(0).default(0),
  downPaymentSaved: z.number().min(0).default(0),
  loanAmount: z.number().min(0).default(0),
  loanMonths: z.number().int().min(0).max(120).default(0),
  loanStartMonth: z.number().int().min(1).max(12).default(1),
  loanStartYear: z.number().int().min(2000).max(2100).default(2026),
  monthlyPayment: z.number().min(0).default(0),
  currency: currencyEnum.default('USD'),
  dollarRate: z.number().min(0).default(0),
  color: z.string().max(20).default('#2563eb'),
});

export const updateVehicleSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  version: z.string().trim().max(60).nullable().optional(),
  year: z.number().int().min(1990).max(2100).nullable().optional(),
  imageUrl: z.url().max(500).nullable().optional(),
  totalPrice: z.number().min(0).optional(),
  downPaymentTarget: z.number().min(0).optional(),
  downPaymentSaved: z.number().min(0).optional(),
  loanAmount: z.number().min(0).optional(),
  loanMonths: z.number().int().min(0).max(120).optional(),
  loanStartMonth: z.number().int().min(1).max(12).optional(),
  loanStartYear: z.number().int().min(2000).max(2100).optional(),
  monthlyPayment: z.number().min(0).optional(),
  currency: currencyEnum.optional(),
  dollarRate: z.number().min(0).optional(),
  status: vehicleStatusEnum.optional(),
  color: z.string().max(20).optional(),
});

export const addVehicleExpenseSchema = z.object({
  vehicleId: z.uuid(),
  category: z.string().trim().min(1).max(40).default('Otro'),
  concept: z.string().trim().min(1, 'Concepto requerido').max(200),
  amount: z.number().min(0).default(0),
  currency: currencyEnum.default('USD'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  paid: z.boolean().default(false),
  note: z.string().trim().max(280).nullable().optional(),
});

export const updateVehicleExpenseSchema = z.object({
  id: z.uuid(),
  category: z.string().trim().min(1).max(40).optional(),
  concept: z.string().trim().min(1).max(200).optional(),
  amount: z.number().min(0).optional(),
  currency: currencyEnum.optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  paid: z.boolean().optional(),
  note: z.string().trim().max(280).nullable().optional(),
});

export const deleteVehicleExpenseSchema = z.object({ id: z.uuid() });

export const toggleVehicleExpensePaidSchema = z.object({
  id: z.uuid(),
  paid: z.boolean(),
});

export const contributeDownPaymentSchema = z.object({
  id: z.uuid(),
  amount: z.number(),
});

export const payOffLoanSchema = z.object({ id: z.uuid() });

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
