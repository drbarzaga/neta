import {
  LayoutDashboard,
  CalendarDays,
  Target,
  PiggyBank,
  BarChart3,
  Tags,
  Bookmark,
  UploadCloud,
  Settings,
  ListTodo,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Fecha (YYYY-MM-DD) en que se agregó la sección. Muestra "Nuevo" unos días. */
  addedOn?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { title: 'Resumen', href: '/', icon: LayoutDashboard },
  { title: 'Meses', href: '/meses', icon: CalendarDays },
  { title: 'Metas', href: '/metas', icon: Target, addedOn: '2026-06-30' },
  { title: 'Ahorros', href: '/ahorros', icon: PiggyBank, addedOn: '2026-07-06' },
  { title: 'Todos', href: '/todos', icon: ListTodo, addedOn: '2026-07-15' },
  { title: 'Analítica', href: '/analitica', icon: BarChart3 },
  { title: 'Categorías', href: '/categorias', icon: Tags },
  { title: 'Plantillas', href: '/plantillas', icon: Bookmark },
  { title: 'Importar', href: '/importar', icon: UploadCloud },
  { title: 'Configuración', href: '/configuracion', icon: Settings },
];

/** Días que se muestra el badge "Nuevo" desde que se agrega una sección. */
const NEW_BADGE_DAYS = 14;

/** True si la sección se agregó hace menos de NEW_BADGE_DAYS días. */
export function isNewNavItem(item: NavItem): boolean {
  if (!item.addedOn) return false;
  const added = new Date(`${item.addedOn}T00:00:00`).getTime();
  if (Number.isNaN(added)) return false;
  return Date.now() - added < NEW_BADGE_DAYS * 86_400_000;
}
