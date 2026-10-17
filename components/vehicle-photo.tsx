'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { VehicleSketch } from './vehicle-sketch';

/**
 * Foto real del vehículo si hay `imageUrl` (y carga bien); si no, cae al
 * boceto genérico. Usa <img> nativo (no next/image) porque la URL puede
 * venir de cualquier host que el usuario haya pegado.
 */
export function VehiclePhoto({
  imageUrl,
  color,
  alt,
  className,
}: {
  imageUrl?: string | null;
  color?: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return <VehicleSketch color={color} className={className} />;
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      onError={() => setFailed(true)}
      className={cn('rounded-xl object-cover', className)}
    />
  );
}
