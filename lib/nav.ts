import {
  RiDashboardLine,
  RiCalendarLine,
  RiTargetLine,
  RiSafeLine,
  RiBarChartBoxLine,
  RiPriceTag2Line,
  RiBookmarkLine,
  RiUploadCloudLine,
  RiSettings2Line,
  RiTodoLine,
  RiPlaneLine,
  RiCarLine,
  type RemixiconComponentType,
} from '@remixicon/react';

export interface NavItem {
  title: string;
  href: string;
  icon: RemixiconComponentType;
  /** Fecha (YYYY-MM-DD) en que se agregó la sección. Muestra "Nuevo" unos días. */
  addedOn?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { title: 'Resumen', href: '/', icon: RiDashboardLine },
  { title: 'Meses', href: '/meses', icon: RiCalendarLine },
  { title: 'Metas', href: '/metas', icon: RiTargetLine, addedOn: '2026-06-30' },
  { title: 'Ahorros', href: '/ahorros', icon: RiSafeLine, addedOn: '2026-07-06' },
  { title: 'Todos', href: '/todos', icon: RiTodoLine, addedOn: '2026-07-15' },
  { title: 'Viajes', href: '/viajes', icon: RiPlaneLine, addedOn: '2026-07-15' },
  { title: 'Auto', href: '/auto', icon: RiCarLine, addedOn: '2026-10-17' },
  { title: 'Analítica', href: '/analitica', icon: RiBarChartBoxLine },
  { title: 'Categorías', href: '/categorias', icon: RiPriceTag2Line },
  { title: 'Plantillas', href: '/plantillas', icon: RiBookmarkLine },
  { title: 'Importar', href: '/importar', icon: RiUploadCloudLine },
  { title: 'Configuración', href: '/configuracion', icon: RiSettings2Line },
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
