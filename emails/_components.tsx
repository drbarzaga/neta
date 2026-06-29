import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';

export const PRIMARY_COLOR = '#0f766e';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export function EmailLayout({
  preview,
  heading,
  children,
}: {
  preview: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={{ marginBottom: 24 }}>
            <Text style={brand}>Neta</Text>
          </Section>
          <Heading style={h1}>{heading}</Heading>
          {children}
          <Section style={{ marginTop: 32, borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
            <Text style={footer}>
              Enviado por Neta · <a href={APP_URL} style={link}>{APP_URL}</a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: '#f3f4f6', fontFamily: 'Arial, sans-serif', padding: '24px 0' };
const container = {
  backgroundColor: '#ffffff',
  borderRadius: 12,
  margin: '0 auto',
  maxWidth: 560,
  padding: 32,
};
const brand = { color: PRIMARY_COLOR, fontSize: 20, fontWeight: 700, margin: 0 };
const h1 = { color: '#111827', fontSize: 22, fontWeight: 700, margin: '0 0 16px' };
const footer = { color: '#9ca3af', fontSize: 12, margin: 0 };
const link = { color: PRIMARY_COLOR };
