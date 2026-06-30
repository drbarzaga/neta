'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wallet } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isNewNavItem } from '@/lib/nav';
import { NavUser } from './nav-user';

export function AppSidebar({
  user,
}: {
  user: { name: string; email: string; image?: string | null };
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
            >
              <Link href="/">
                <div className="bg-primary text-primary-foreground flex aspect-square size-9 shrink-0 items-center justify-center rounded-full shadow-sm group-data-[collapsible=icon]:size-8">
                  <Wallet className="size-5 group-data-[collapsible=icon]:size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-base font-semibold">Neta</span>
                  <span className="text-muted-foreground truncate text-xs">
                    Gastos mensuales
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);
                const isNew = isNewNavItem(item);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      size="lg"
                      isActive={active}
                      className={cn(
                        'relative gap-3 text-[0.95rem] font-medium [&>svg]:size-5',
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
                            {/* Expandido: pill "Nuevo" a la derecha, centrado */}
                            <span className="bg-primary/15 text-primary ml-auto rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold group-data-[collapsible=icon]:hidden">
                              Nuevo
                            </span>
                            {/* Colapsado: puntito sobre el icono */}
                            <span className="bg-primary ring-sidebar absolute top-1.5 right-3 hidden size-2 rounded-full ring-2 group-data-[collapsible=icon]:block" />
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
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
