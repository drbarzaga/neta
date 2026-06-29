import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-server';
import { getCategories } from '../meses/[id]/queries';
import { getTemplatesWithCategory } from './queries';
import { TemplatesClient } from './_components/templates-client';

export const metadata: Metadata = { title: 'Plantillas — Neta' };

export default async function PlantillasPage() {
  const { userId } = await requireSession();
  const [categories, templates] = await Promise.all([
    getCategories(userId),
    getTemplatesWithCategory(userId),
  ]);

  return (
    <TemplatesClient
      categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
      templates={templates}
    />
  );
}
