'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isNewNavItem, type NavItem } from '@/lib/nav';
import { NetaMarkDark, NetaWordmarkDark } from '@/components/brand/neta-wordmark';
import { NavUser } from './nav-user';

// Primer ítem de "Herramientas" (el resto de NAV_ITEMS, en orden, es "Mes").
const TOOLS_START_HREF = '/analitica';

function splitNavGroups(items: NavItem[]) {
  const idx = items.findIndex((i) => i.href === TOOLS_START_HREF);
  if (idx === -1) return { month: items, tools: [] as NavItem[] };
  return { month: items.slice(0, idx), tools: items.slice(idx) };
}

export function AppSidebar({
  user,
}: {
  user: { name: string; email: string; image?: string | null };
}) {
  const pathname = usePathname();
  const { month, tools } = splitNavGroups(NAV_ITEMS);

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-transparent group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
            >
              <Link href="/">
                <NetaMarkDark className="hidden size-[32px]! shrink-0 group-data-[collapsible=icon]:block" />
                <NetaWordmarkDark className="h-[32px]! w-auto! group-data-[collapsible=icon]:hidden" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Mes" items={month} pathname={pathname} />
        <NavGroup label="Herramientas" items={tools} pathname={pathname} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="px-3 font-mono text-[11px] font-medium tracking-[.08em] text-(--sb-mute) uppercase">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const isNew = isNewNavItem(item);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  size="lg"
                  isActive={active}
                  className={cn(
                    'relative h-auto gap-3 rounded-[12px] px-3 py-2.5 text-[15px] text-(--sb-ink) [&>svg]:size-[18px]',
                    'hover:bg-(--sb-hover) hover:text-(--sb-ink)',
                    'data-active:bg-(--lime) data-active:font-semibold data-active:text-(--sb) data-active:hover:bg-(--lime) data-active:hover:text-(--sb)',
                    // Colapsado: icono arriba, texto debajo, todo centrado.
                    'group-data-[collapsible=icon]:!h-auto group-data-[collapsible=icon]:!w-full',
                    'group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center',
                    'group-data-[collapsible=icon]:!gap-1 group-data-[collapsible=icon]:!px-1 group-data-[collapsible=icon]:!py-2.5'
                  )}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:text-center group-data-[collapsible=icon]:text-[0.65rem] group-data-[collapsible=icon]:font-medium group-data-[collapsible=icon]:leading-tight group-data-[collapsible=icon]:!overflow-visible group-data-[collapsible=icon]:!whitespace-normal group-data-[collapsible=icon]:break-words">
                      {item.title}
                    </span>
                    {isNew && (
                      <>
                        {/* Expandido: chip "Nuevo" a la derecha */}
                        <span className="ml-auto rounded-full bg-[#1F3A2E] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-(--lime) group-data-[collapsible=icon]:hidden">
                          Nuevo
                        </span>
                        {/* Colapsado: puntito sobre el icono */}
                        <span className="absolute top-1.5 right-3 hidden size-2 rounded-full bg-(--lime) ring-2 ring-sidebar group-data-[collapsible=icon]:block" />
                      </>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
