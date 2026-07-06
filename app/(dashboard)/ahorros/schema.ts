import { z } from 'zod';

const currencyEnum = z.string().trim().toUpperCase().min(3).max(3);
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre al apartado').max(80),
  icon: z.string().min(1).max(40).default('piggy-bank'),
  color: z.string().max(20).default('#10b981'),
  currency: currencyEnum.default('UYU'),
  // Saldo inicial opcional (crea un primer movimiento de depósito).
  initialBalance: z.number().min(0).default(0),
});

export const updateAccountSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  icon: z.string().min(1).max(40).optional(),
  color: z.string().max(20).optional(),
  currency: currencyEnum.optional(),
});

// Movimiento: kind decide el signo; amount siempre positivo.
export const addMovementSchema = z.object({
  accountId: z.uuid(),
  kind: z.enum(['deposit', 'withdraw']),
  amount: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  note: z.string().trim().max(140).nullable().optional(),
  date: dateField,
});

export const deleteMovementSchema = z.object({
  id: z.uuid(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
