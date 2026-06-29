import {
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  Tags,
  Bookmark,
  UploadCloud,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { title: 'Resumen', href: '/', icon: LayoutDashboard },
  { title: 'Meses', href: '/meses', icon: CalendarDays },
  { title: 'Analítica', href: '/analitica', icon: BarChart3 },
  { title: 'Categorías', href: '/categorias', icon: Tags },
  { title: 'Plantillas', href: '/plantillas', icon: Bookmark },
  { title: 'Importar', href: '/importar', icon: UploadCloud },
  { title: 'Configuración', href: '/configuracion', icon: Settings },
];
