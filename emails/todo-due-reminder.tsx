import { Hr, Row, Column, Text } from '@react-email/components';
import { EmailLayout } from './_components';

export interface TodoDueItem {
  title: string;
  dueDateLabel: string;
  year: number;
}

export function TodoDueReminderEmail({
  name,
  items,
}: {
  name?: string;
  items: TodoDueItem[];
}) {
  return (
    <EmailLayout
      preview={`Tienes ${items.length} tarea(s) por vencer`}
      heading="Tareas por vencer"
    >
      <Text style={text}>
        Hola{name ? ` ${name}` : ''}, estas tareas de tu tablero de Todos están
        próximas a vencer:
      </Text>
      <Hr style={hr} />
      {items.map((it, i) => (
        <Row key={i} style={{ marginBottom: 8 }}>
          <Column>
            <Text style={concept}>{it.title}</Text>
            <Text style={muted}>Todos {it.year}</Text>
          </Column>
          <Column align="right">
            <Text style={amount}>{it.dueDateLabel}</Text>
          </Column>
        </Row>
      ))}
      <Hr style={hr} />
      <Text style={muted}>
        Muévelas a una columna de &quot;hecho&quot; en la app para dejar de recibir avisos.
      </Text>
    </EmailLayout>
  );
}

export default TodoDueReminderEmail;

const text = { color: '#374151', fontSize: 14, lineHeight: '22px' };
const concept = { color: '#111827', fontSize: 14, fontWeight: 600, margin: 0 };
const amount = { color: '#111827', fontSize: 14, fontWeight: 700, margin: 0 };
const muted = { color: '#9ca3af', fontSize: 12, margin: 0 };
const hr = { borderColor: '#e5e7eb', margin: '16px 0' };
