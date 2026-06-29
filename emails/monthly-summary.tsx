import { Hr, Row, Column, Text } from '@react-email/components';
import { EmailLayout } from './_components';

export interface SummaryCategory {
  name: string;
  amountLabel: string;
}

export function MonthlySummaryEmail({
  name,
  periodLabel,
  incomeLabel,
  totalLabel,
  restanteLabel,
  pctLabel,
  categories,
}: {
  name?: string;
  periodLabel: string;
  incomeLabel: string;
  totalLabel: string;
  restanteLabel: string;
  pctLabel: string;
  categories: SummaryCategory[];
}) {
  return (
    <EmailLayout
      preview={`Resumen de ${periodLabel}`}
      heading={`Resumen de ${periodLabel}`}
    >
      <Text style={text}>Hola{name ? ` ${name}` : ''}, así cerró tu mes:</Text>
      <Hr style={hr} />
      <SummaryRow label="Ingreso total" value={incomeLabel} />
      <SummaryRow label="Total utilizado" value={totalLabel} />
      <SummaryRow label="Restante" value={restanteLabel} />
      <SummaryRow label="% usado" value={pctLabel} />
      <Hr style={hr} />
      <Text style={section}>Por categoría</Text>
      {categories.map((c, i) => (
        <SummaryRow key={i} label={c.name} value={c.amountLabel} />
      ))}
    </EmailLayout>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ marginBottom: 6 }}>
      <Column>
        <Text style={muted}>{label}</Text>
      </Column>
      <Column align="right">
        <Text style={amount}>{value}</Text>
      </Column>
    </Row>
  );
}

export default MonthlySummaryEmail;

const text = { color: '#374151', fontSize: 14, lineHeight: '22px' };
const amount = { color: '#111827', fontSize: 14, fontWeight: 700, margin: 0 };
const muted = { color: '#6b7280', fontSize: 13, margin: 0 };
const section = { color: '#111827', fontSize: 14, fontWeight: 600, margin: '4px 0' };
const hr = { borderColor: '#e5e7eb', margin: '16px 0' };
