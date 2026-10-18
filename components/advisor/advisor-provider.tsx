'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

interface PendingAsk {
  /** Incrementa en cada `ask()` para que el widget note una pregunta nueva aunque repita texto. */
  id: number;
  prompt: string;
  autoSend: boolean;
}

interface AdvisorContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Abre el panel sin preguntar nada (botón flotante, ítem del sidebar). */
  openAdvisor: () => void;
  /** Abre el panel con una pregunta ya armada. Por defecto la envía sola. */
  ask: (prompt: string, opts?: { autoSend?: boolean }) => void;
  pending: PendingAsk | null;
  clearPending: () => void;
}

const AdvisorContext = createContext<AdvisorContextValue | null>(null);

/**
 * Comparte el estado del panel del asesor (abierto/cerrado, pregunta pendiente)
 * entre el widget flotante y cualquier botón contextual de otras páginas, para
 * que "preguntarle al asesor sobre esto" pueda vivir fuera del propio widget.
 */
export function AdvisorProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingAsk | null>(null);
  const idRef = useRef(0);

  const ask = useCallback((prompt: string, opts?: { autoSend?: boolean }) => {
    idRef.current += 1;
    setPending({ id: idRef.current, prompt, autoSend: opts?.autoSend ?? true });
    setOpen(true);
  }, []);

  const openAdvisor = useCallback(() => setOpen(true), []);
  const clearPending = useCallback(() => setPending(null), []);

  return (
    <AdvisorContext.Provider value={{ open, setOpen, openAdvisor, ask, pending, clearPending }}>
      {children}
    </AdvisorContext.Provider>
  );
}

export function useAdvisor(): AdvisorContextValue {
  const ctx = useContext(AdvisorContext);
  if (!ctx) throw new Error('useAdvisor debe usarse dentro de <AdvisorProvider>');
  return ctx;
}
