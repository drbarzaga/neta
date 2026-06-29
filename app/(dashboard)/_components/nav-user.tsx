'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Settings, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { authClient } from '@/lib/auth-client';

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function NavUser({
  user,
}: {
  user: { name: string; email: string; image?: string | null };
}) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    toast.success('Sesión cerrada');
    router.push('/login');
    router.refresh();
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:!p-0"
            >
              <Avatar className="size-8 rounded-lg">
                {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
                <AvatarFallback className="rounded-lg">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side="top"
            align="end"
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="font-medium">{user.name}</span>
                <span className="text-muted-foreground text-xs">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/configuracion')}>
              <Settings className="size-4" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="size-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
