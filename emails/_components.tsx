import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { CSSProperties, ReactNode } from 'react';

export const PRIMARY_COLOR = '#0f5a3e';
export const ALERT_COLOR = '#e4572e';
export const ACCENT_COLOR = '#8fae2c'; // lime oscurecido, legible sobre blanco
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export function EmailLayout({
  preview,
  heading,
  eyebrow,
  accentColor = PRIMARY_COLOR,
  showPreferencesLink = false,
  children,
}: {
  preview: string;
  heading: string;
  eyebrow?: string;
  accentColor?: string;
  showPreferencesLink?: boolean;
  children: ReactNode;
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={outer}>
          <Section style={{ textAlign: 'center', marginBottom: 28 }}>
            <Img
              src={`${APP_URL}/brand/neta-logo-email.png`}
              alt="Neta"
              width="118"
              height="45"
              style={{ margin: '0 auto' }}
            />
          </Section>

          <Section style={{ ...card, borderTopColor: accentColor }}>
            {eyebrow && (
              <Text
                style={{
                  ...eyebrowStyle,
                  color: accentColor,
                  backgroundColor: `${accentColor}17`,
                }}
              >
                {eyebrow}
              </Text>
            )}
            <Heading style={h1}>{heading}</Heading>
            {children}
          </Section>

          <Section style={{ textAlign: 'center', marginTop: 28 }}>
            <Text style={footerBrand}>
              Enviado por <span style={{ color: PRIMARY_COLOR, fontWeight: 700 }}>neta</span>
            </Text>
            <Text style={footerLinks}>
              <a href={APP_URL} style={link}>
                {APP_URL.replace(/^https?:\/\//, '')}
              </a>
              {showPreferencesLink && (
                <>
                  {' · '}
                  <a href={`${APP_URL}/configuracion`} style={link}>
                    Preferencias de notificaciones
                  </a>
                </>
              )}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: '#f1efe9',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  padding: '40px 0',
};

const outer = {
  margin: '0 auto',
  maxWidth: 560,
  padding: '0 16px',
};

const card: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 16,
  border: '1px solid #e8e5dc',
  borderTopWidth: 4,
  borderTopStyle: 'solid',
  padding: '36px 40px 32px',
  boxShadow: '0 1px 3px rgba(15, 90, 62, 0.06)',
};

const eyebrowStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  padding: '5px 11px',
  borderRadius: 999,
  margin: '0 0 14px',
};

const h1 = {
  color: '#19201b',
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  margin: '0 0 18px',
};

const footerBrand = { color: '#9ca3af', fontSize: 12, margin: '0 0 2px' };
const footerLinks = { color: '#9ca3af', fontSize: 12, margin: 0 };
const link = { color: PRIMARY_COLOR, textDecoration: 'underline' };
