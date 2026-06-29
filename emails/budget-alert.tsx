import { Text } from '@react-email/components';
import { EmailLayout } from './_components';

export function BudgetAlertEmail({
  name,
  periodLabel,
  pctLabel,
  totalLabel,
  incomeLabel,
  restanteLabel,
}: {
  name?: string;
  periodLabel: string;
  pctLabel: string;
  totalLabel: string;
  incomeLabel: string;
  restanteLabel: string;
}) {
  return (
    <EmailLayout
      preview={`Alerta de presupuesto: ${pctLabel} usado en ${periodLabel}`}
      heading="⚠️ Alerta de presupuesto"
    >
      <Text style={text}>
        Hola{name ? ` ${name}` : ''}, ya usaste <strong>{pctLabel}</strong> de tu
        ingreso en <strong>{periodLabel}</strong>.
      </Text>
      <Text style={text}>
        Utilizado: <strong>{totalLabel}</strong> de {incomeLabel}.<br />
        Restante: <strong>{restanteLabel}</strong>.
      </Text>
      <Text style={muted}>
        Revisa tus gastos en la app para ajustar lo que resta del mes.
      </Text>
    </EmailLayout>
  );
}

export default BudgetAlertEmail;

const text = { color: '#374151', fontSize: 14, lineHeight: '22px' };
const muted = { color: '#9ca3af', fontSize: 12, marginTop: 16 };
