import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth-server';
import { getCategories } from '../meses/[id]/queries';
import { CategoriesClient } from './_components/categories-client';

export const metadata: Metadata = { title: 'Categorías — Neta' };

export default async function CategoriasPage() {
  const { userId } = await requireSession();
  const categories = await getCategories(userId);
  return <CategoriesClient categories={categories} />;
}
