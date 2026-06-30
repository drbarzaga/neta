import { detectBrand } from '@/lib/brands';

/** Luminancia del color de marca; si es muy oscuro/claro usa el color del texto. */
function fillFor(hex: string): string {
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return 'currentColor';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 40 || lum > 215 ? 'currentColor' : `#${hex}`;
}

/**
 * Muestra el logo de la marca detectada en el texto (Netflix, Spotify, etc.).
 * No renderiza nada si no reconoce ninguna marca.
 */
export function BrandLogo({
  concept,
  className,
}: {
  concept: string | null | undefined;
  className?: string;
}) {
  const brand = detectBrand(concept);
  if (!brand) return null;
  return (
    <svg
      role="img"
      aria-label={brand.title}
      viewBox="0 0 24 24"
      className={className}
      style={{ color: fillFor(brand.hex) }}
    >
      <title>{brand.title}</title>
      <path d={brand.path} fill="currentColor" />
    </svg>
  );
}
