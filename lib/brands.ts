import {
  siNetflix,
  siSpotify,
  siYoutube,
  siGoogle,
  siApple,
  siApplemusic,
  siAppletv,
  siIcloud,
  siParamountplus,
  siAnthropic,
  siHbo,
  siMax,
  siNotion,
  siGithub,
  siDropbox,
} from 'simple-icons';

export interface Brand {
  title: string;
  hex: string;
  path: string;
}

// Marcas conocidas para suscripciones. El orden importa: lo más específico
// primero (p. ej. "apple music" antes que "apple").
const BRANDS: { keywords: string[]; icon: Brand }[] = [
  { keywords: ['netflix'], icon: siNetflix },
  { keywords: ['spotify'], icon: siSpotify },
  { keywords: ['youtube'], icon: siYoutube },
  { keywords: ['hbo max', 'hbomax'], icon: siMax },
  { keywords: ['hbo'], icon: siHbo },
  { keywords: ['paramount'], icon: siParamountplus },
  { keywords: ['anthropic', 'claude'], icon: siAnthropic },
  { keywords: ['apple music'], icon: siApplemusic },
  { keywords: ['apple tv', 'appletv'], icon: siAppletv },
  { keywords: ['icloud'], icon: siIcloud },
  { keywords: ['apple'], icon: siApple },
  { keywords: ['google', 'gmail', 'drive', 'google one'], icon: siGoogle },
  { keywords: ['notion'], icon: siNotion },
  { keywords: ['github'], icon: siGithub },
  { keywords: ['dropbox'], icon: siDropbox },
];

/** Detecta la marca a partir del texto (concepto del gasto). null si no hay. */
export function detectBrand(text: string | null | undefined): Brand | null {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const { keywords, icon } of BRANDS) {
    if (keywords.some((k) => t.includes(k))) return icon;
  }
  return null;
}
