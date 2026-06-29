'use client';

import { ThemeProvider } from 'next-themes';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmProvider } from '@/components/confirm-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <NuqsAdapter>
        <TooltipProvider delayDuration={200}>
          <ConfirmProvider>{children}</ConfirmProvider>
        </TooltipProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
