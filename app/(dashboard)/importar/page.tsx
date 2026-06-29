import type { Metadata } from 'next';
import { ImportClient } from './_components/import-client';

export const metadata: Metadata = { title: 'Importar — Neta' };

export default function ImportarPage() {
  return <ImportClient />;
}
