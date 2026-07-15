import { z } from 'zod';

export const preferenceSchema = z.object({
  dueRemindersEnabled: z.boolean(),
  dueReminderDaysBefore: z.number().int().min(0).max(30),
  monthlySummaryEnabled: z.boolean(),
  budgetAlertEnabled: z.boolean(),
  budgetAlertThresholdPct: z.number().int().min(1).max(200),
  todoDueRemindersEnabled: z.boolean(),
  todoDueReminderDaysBefore: z.number().int().min(0).max(30),
});

export type PreferenceInput = z.infer<typeof preferenceSchema>;

export const regionSchema = z.object({
  country: z.string().min(2).max(3),
  arCasa: z.string().min(2).max(20),
  displayCurrency: z.enum(['local', 'usd']),
});

export type RegionInput = z.infer<typeof regionSchema>;

export const appearanceSchema = z.object({
  animationsEnabled: z.boolean(),
});

export type AppearanceInput = z.infer<typeof appearanceSchema>;

// BYOK: el campo vacío borra la key; si no, debe ser de Anthropic (sk-ant-) o
// de OpenRouter (sk-or-).
export const apiKeySchema = z.object({
  apiKey: z
    .string()
    .max(200)
    .refine((v) => v === '' || v.startsWith('sk-ant-') || v.startsWith('sk-or-'), {
      message: 'Usa una key de Anthropic (sk-ant-…) o de OpenRouter (sk-or-…).',
    }),
});

export type ApiKeyInput = z.infer<typeof apiKeySchema>;
