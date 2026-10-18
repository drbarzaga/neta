'use client';

import type { ComponentProps } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdvisor } from './advisor-provider';

type ButtonProps = ComponentProps<typeof Button>;

/**
 * Atajo contextual para abrir el asesor con una pregunta ya armada sobre lo
 * que se está mirando (un mes, una meta, un vehículo…), en vez de depender
 * solo del botón flotante genérico.
 */
export function AskAdvisorButton({
  prompt,
  label = 'Preguntarle al asesor',
  variant = 'outline',
  size = 'sm',
  className,
  iconOnly = false,
}: {
  prompt: string;
  label?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  iconOnly?: boolean;
}) {
  const { ask } = useAdvisor();

  return (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? 'icon' : size}
      className={className}
      onClick={() => ask(prompt)}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
    >
      <Sparkles />
      {!iconOnly && label}
    </Button>
  );
}
