import { Hr, Row, Column, Text } from '@react-email/components';
import { EmailLayout } from './_components';

export interface DueItem {
  concept: string;
  amountLabel: string;
  dueDateLabel: string;
  periodLabel: string;
}

export function DueReminderEmail({
  name,
  items,
}: {
  name?: string;
  items: DueItem[];
}) {
  return (
    <EmailLayout
      preview={`Tienes ${items.length} gasto(s) por vencer`}
      heading="Gastos por vencer"
    >
      <Text style={text}>
        Hola{name ? ` ${name}` : ''}, estos gastos están próximos a vencer:
      </Text>
      <Hr style={hr} />
      {items.map((it, i) => (
        <Row key={i} style={{ marginBottom: 8 }}>
          <Column>
            <Text style={concept}>{it.concept}</Text>
            <Text style={muted}>
              {it.periodLabel} · vence {it.dueDateLabel}
            </Text>
          </Column>
          <Column align="right">
            <Text style={amount}>{it.amountLabel}</Text>
          </Column>
        </Row>
      ))}
      <Hr style={hr} />
      <Text style={muted}>
        Marca los gastos como pagados en la app para dejar de recibir avisos.
      </Text>
    </EmailLayout>
  );
}

export default DueReminderEmail;

const text = { color: '#374151', fontSize: 14, lineHeight: '22px' };
const concept = { color: '#111827', fontSize: 14, fontWeight: 600, margin: 0 };
const amount = { color: '#111827', fontSize: 14, fontWeight: 700, margin: 0 };
const muted = { color: '#9ca3af', fontSize: 12, margin: 0 };
const hr = { borderColor: '#e5e7eb', margin: '16px 0' };
