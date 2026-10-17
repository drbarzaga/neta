import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  const svg = await readFile(path.join(process.cwd(), 'app/icon.svg'), 'utf8');
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  return new ImageResponse(
    (
      // Sin bordes redondeados: iOS aplica su propia máscara al ícono.
      <img src={dataUri} width={size.width} height={size.height} alt="" />
    ),
    { ...size }
  );
}
