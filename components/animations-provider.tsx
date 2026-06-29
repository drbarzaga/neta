'use client';

import { createContext, useContext } from 'react';

const AnimationsContext = createContext(false);

/** Indica si las animaciones de UI están activadas (preferencia del usuario). */
export function useAnimations(): boolean {
  return useContext(AnimationsContext);
}

export function AnimationsProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimationsContext.Provider value={enabled}>
      {children}
    </AnimationsContext.Provider>
  );
}
