'use client';

import { useTheme } from 'next-themes';
import { RiMoonLine, RiSunLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Cambiar tema"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <RiSunLine className="size-5 dark:hidden" />
      <RiMoonLine className="hidden size-5 dark:block" />
    </Button>
  );
}
