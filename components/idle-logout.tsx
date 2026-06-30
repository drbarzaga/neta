'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

/** Minutos de inactividad antes de cerrar la sesión. */
const IDLE_MINUTES = 30;
const IDLE_MS = IDLE_MINUTES * 60 * 1000;

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'visibilitychange',
] as const;

/**
 * Cierra la sesión tras un período de inactividad (sin interacción del usuario)
 * y redirige al login. Montar dentro del área autenticada.
 */
export function IdleLogout() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let done = false;

    const logout = () => {
      if (done) return;
      done = true;
      void authClient.signOut().finally(() => {
        router.push('/login?expired=1');
        router.refresh();
      });
    };

    const reset = () => {
      if (done) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(logout, IDLE_MS);
    };

    for (const e of ACTIVITY_EVENTS) {
      window.addEventListener(e, reset, { passive: true });
    }
    reset();

    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, reset);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router]);

  return null;
}
