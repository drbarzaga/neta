import { ViewTransition } from 'react';

/**
 * Anima la entrada y salida de una página al navegar. `default="none"` evita
 * que se dispare con otras transiciones, como guardar un gasto.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
