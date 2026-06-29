import { createElement } from 'react';
import { getCategoryIcon } from '@/lib/category-icons';

/** Renderiza el icono de una categoría desde el registro estático. */
export function CategoryIcon({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  return createElement(getCategoryIcon(name), { className });
}
