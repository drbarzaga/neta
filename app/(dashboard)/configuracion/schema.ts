import { z } from 'zod';

export const preferenceSchema = z.object({
  dueRemindersEnabled: z.boolean(),
  dueReminderDaysBefore: z.number().int().min(0).max(30),
  monthlySummaryEnabled: z.boolean(),
  budgetAlertEnabled: z.boolean(),
  budgetAlertThresholdPct: z.number().int().min(1).max(200),
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
