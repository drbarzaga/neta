import { z } from 'zod';

export const addCategorySchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido'),
  icon: z.string().min(1).max(40).default('tag'),
});

export const updateCategorySchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().min(1).max(40).optional(),
});

export type AddCategoryInput = z.infer<typeof addCategorySchema>;
