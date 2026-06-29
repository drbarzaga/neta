import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { verifySession } from '@/lib/auth-server';
import {
  getPeriod,
  getCategories,
  getExpenses,
} from '@/app/(dashboard)/meses/[id]/queries';
import { getOrCreateUserSettings } from '@/app/(dashboard)/configuracion/queries';
import { getCountry } from '@/lib/countries';
import { periodTotals, toUsd, formatUSD, formatMoney } from '@/lib/money';

export const runtime = 'nodejs';

const PRIMARY = '#0f766e';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: '#111827', fontFamily: 'Helvetica' },
  h1: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
  muted: { color: '#6b7280' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  metaRow: { flexDirection: 'row', gap: 24, marginBottom: 16 },
  metaItem: {},
  metaLabel: { color: '#6b7280', fontSize: 8, marginBottom: 2 },
  metaValue: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  summary: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
  },
  cardLabel: { color: '#6b7280', fontSize: 8 },
  cardValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: PRIMARY,
    color: '#ffffff',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 10,
    marginBottom: 4,
  },
  catName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  trow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  thead: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 3 },
  th: { color: '#6b7280', fontSize: 8 },
  cConcept: { flex: 3 },
  cAmount: { flex: 2, textAlign: 'right' },
  cUsd: { flex: 2, textAlign: 'right', color: '#6b7280' },
  cStatus: { flex: 1.5 },
  cDue: { flex: 1.5 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: '#9ca3af',
    fontSize: 8,
  },
});

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  vencido: 'Vencido',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await verifySession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const period = await getPeriod(session.userId, id);
  if (!period) return new Response('Not found', { status: 404 });

  const [categories, expenses] = await Promise.all([
    getCategories(session.userId),
    getExpenses(session.userId, id),
  ]);

  const settings = await getOrCreateUserSettings(session.userId);
  const locale = getCountry(settings.country).locale;
  const localCurrency = period.localCurrency;
  const fmtLocal = (n: number) => formatMoney(n, localCurrency, locale);

  const rate = period.dollarRate;
  const totals = periodTotals(expenses, rate, period.incomeTotal);
  const grouped = new Map<string, typeof expenses>();
  for (const c of categories) grouped.set(c.id, []);
  for (const e of expenses) {
    if (!grouped.has(e.categoryId)) grouped.set(e.categoryId, []);
    grouped.get(e.categoryId)!.push(e);
  }

  const generated = new Intl.DateTimeFormat('es-UY', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());

  const doc = (
    <Document title={`Neta — ${period.label}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={{ color: PRIMARY, fontSize: 11, fontFamily: 'Helvetica-Bold' }}>
              Neta
            </Text>
            <Text style={styles.h1}>{period.label}</Text>
          </View>
          <Text style={styles.muted}>
            {period.status === 'open' ? 'Abierto' : 'Cerrado'}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Ingreso total ({localCurrency})</Text>
            <Text style={styles.metaValue}>{fmtLocal(period.incomeTotal)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Dólar (cotización)</Text>
            <Text style={styles.metaValue}>{rate}</Text>
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total utilizado</Text>
            <Text style={styles.cardValue}>{fmtLocal(totals.totalLocal)}</Text>
            <Text style={styles.cardLabel}>{formatUSD(totals.totalUsd, locale)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Restante del mes</Text>
            <Text style={styles.cardValue}>{fmtLocal(totals.restante)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>% usado</Text>
            <Text style={styles.cardValue}>{totals.pctUsado.toFixed(1)}%</Text>
          </View>
        </View>

        {categories.map((cat) => {
          const rows = grouped.get(cat.id) ?? [];
          const catTotal = rows.reduce(
            (s, e) => s + (e.currency === 'USD' ? e.amount * rate : e.amount),
            0
          );
          return (
            <View key={cat.id} wrap={false}>
              <View style={styles.catHeader}>
                <Text style={styles.catName}>{cat.name}</Text>
                <Text style={styles.catName}>{fmtLocal(catTotal)}</Text>
              </View>
              {rows.length > 0 ? (
                <>
                  <View style={styles.thead}>
                    <Text style={[styles.th, styles.cConcept]}>Concepto</Text>
                    <Text style={[styles.th, styles.cAmount]}>Monto</Text>
                    <Text style={[styles.th, styles.cUsd]}>USD aprox</Text>
                    <Text style={[styles.th, styles.cStatus]}>Estado</Text>
                    <Text style={[styles.th, styles.cDue]}>Vencimiento</Text>
                  </View>
                  {rows.map((e) => {
                    const usd = toUsd({ amount: e.amount, currency: e.currency }, rate);
                    return (
                      <View key={e.id} style={styles.trow}>
                        <Text style={styles.cConcept}>{e.concept}</Text>
                        <Text style={styles.cAmount}>
                          {formatMoney(e.amount, e.currency, locale)}
                        </Text>
                        <Text style={styles.cUsd}>{usd ? formatUSD(usd, locale) : '—'}</Text>
                        <Text style={styles.cStatus}>{STATUS_LABEL[e.status]}</Text>
                        <Text style={styles.cDue}>{formatDate(e.dueDate)}</Text>
                      </View>
                    );
                  })}
                </>
              ) : (
                <Text style={[styles.muted, { paddingHorizontal: 8, paddingVertical: 4 }]}>
                  Sin gastos.
                </Text>
              )}
            </View>
          );
        })}

        <View style={styles.footer} fixed>
          <Text>Generado por Neta · {generated}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  const filename = `${period.label.replace(/\s+/g, '-')}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
