import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { requireSession } from '@/lib/auth-server';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { HeaderUser } from '@/components/header-user';
import { AnimationsProvider } from '@/components/animations-provider';
import { AdvisorWidget } from '@/components/advisor/advisor-widget';
import { IdleLogout } from '@/components/idle-logout';
import { AppSidebar } from './_components/app-sidebar';
import { HeaderRate, HeaderRateFallback } from './_components/header-rate';
import { getOrCreateUserSettings } from './configuracion/queries';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, user } = await requireSession();
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';
  // Cacheado por request: lo reusan HeaderRate y las páginas (no es un query extra).
  const settings = await getOrCreateUserSettings(userId);

  return (
    <AnimationsProvider enabled={settings.animationsEnabled}>
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          '--sidebar-width': '17rem',
          '--sidebar-width-icon': '6rem',
        } as React.CSSProperties
      }
    >
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="bg-background/70 sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-md md:px-6">
          <SidebarTrigger className="-ml-1 size-9" />
          <div className="flex-1" />
          <Suspense fallback={<HeaderRateFallback />}>
            <HeaderRate userId={userId} />
          </Suspense>
          <ThemeToggle />
          <HeaderUser user={user} />
        </header>
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </SidebarInset>
      <AdvisorWidget />
      <IdleLogout />
    </SidebarProvider>
    </AnimationsProvider>
  );
}
