'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

export function HeaderUser({
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 rounded-full px-1 pr-3 hover:bg-muted"
        >
          <Avatar className="size-8">
            {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
            {user.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3 py-1">
            <Avatar className="size-9">
              {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="text-muted-foreground truncate text-xs">{user.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/configuracion')}>
          <UserIcon className="size-4" />
          Mi perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/configuracion')}>
          <Settings className="size-4" />
          Configuración
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
