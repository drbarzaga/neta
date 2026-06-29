import { Button, Text } from '@react-email/components';
import { EmailLayout, PRIMARY_COLOR } from './_components';

export function ResetPasswordEmail({ url, name }: { url: string; name?: string }) {
  return (
    <EmailLayout
      preview="Restablece tu contraseña de Neta"
      heading="Restablece tu contraseña"
    >
      <Text style={text}>Hola{name ? ` ${name}` : ''},</Text>
      <Text style={text}>
        Recibimos una solicitud para restablecer tu contraseña. Haz clic en el
        botón para elegir una nueva. Si no fuiste tú, puedes ignorar este correo.
      </Text>
      <Button href={url} style={button}>
        Restablecer contraseña
      </Button>
      <Text style={muted}>O copia este enlace: {url}</Text>
    </EmailLayout>
  );
}

export default ResetPasswordEmail;

const text = { color: '#374151', fontSize: 14, lineHeight: '22px' };
const muted = { color: '#9ca3af', fontSize: 12, marginTop: 16, wordBreak: 'break-all' as const };
const button = {
  backgroundColor: PRIMARY_COLOR,
  borderRadius: 8,
  color: '#ffffff',
  display: 'inline-block',
  fontSize: 14,
  fontWeight: 600,
  margin: '16px 0',
  padding: '12px 20px',
  textDecoration: 'none',
};
