import 'server-only';
import { db, eq, category } from '@/db';

export const DEFAULT_CATEGORIES = [
  { name: 'PAGARTE PRIMERO', color: '#86efac', icon: 'piggy-bank' },
  { name: 'TARJETAS', color: '#93c5fd', icon: 'credit-card' },
  { name: 'GASTOS FIJOS', color: '#5eead4', icon: 'home' },
  { name: 'VARIABLES', color: '#bfdbfe', icon: 'shopping-cart' },
];

/** Crea las categorías por defecto si el usuario aún no tiene ninguna. */
export async function ensureDefaultCategories(userId: string) {
  const existing = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.userId, userId));
  if (existing.length > 0) return;

  await db.insert(category).values(
    DEFAULT_CATEGORIES.map((c, i) => ({
      userId,
      name: c.name,
      color: c.color,
      icon: c.icon,
      sortOrder: i,
    }))
  );
}
