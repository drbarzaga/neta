'use client';

import { useState } from 'react';
import { Car } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Foto real del vehículo si hay `imageUrl` (y carga bien); si no, cae a un
 * icono simple con el color del vehículo. Usa <img> nativo (no next/image)
 * porque la URL puede venir de cualquier host que el usuario haya pegado.
 */
export function VehiclePhoto({
  imageUrl,
  color = '#2563eb',
  alt,
  className,
  iconClassName = 'size-7',
}: {
  imageUrl?: string | null;
  color?: string;
  alt: string;
  className?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        onError={() => setFailed(true)}
        className={cn('rounded-xl object-cover', className)}
      />
    );
  }

  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-2xl', className)}
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <Car className={iconClassName} />
    </span>
  );
}
