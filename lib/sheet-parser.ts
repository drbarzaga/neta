// Parser tolerante para el CSV exportado del Google Sheet de gastos.
// Detecta "Ingreso total", "Dólar", la fila de encabezados y las filas de datos.

export interface ParsedRow {
  categoria: string;
  concepto: string;
  amount: number;
  currency: 'UYU' | 'USD';
  status: 'pendiente' | 'pagado' | 'vencido';
  dueDate: string | null;
}

export interface ParsedSheet {
  incomeTotal: number;
  dollarRate: number;
  rows: ParsedRow[];
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function norm(s: string): string {
  return stripAccents((s ?? '').toString().toLowerCase()).trim();
}

export function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  let t = value.toString().replace(/[^0-9.,-]/g, '').trim();
  if (t === '' || t === '-') return 0;
  if (t.includes('.') && t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (t.includes(',')) {
    t = t.replace(',', '.');
  }
  const n = Number(t);
  return Number.isNaN(n) ? 0 : n;
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  const t = value.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${month}-${day}`;
  }
  return null;
}

function parseStatus(value: string | undefined): ParsedRow['status'] {
  const n = norm(value ?? '');
  if (n.includes('pagad')) return 'pagado';
  if (n.includes('vencid')) return 'vencido';
  return 'pendiente';
}

function lastNumberInRow(row: string[]): number {
  for (let i = row.length - 1; i >= 0; i--) {
    const n = parseNumber(row[i]);
    if (n) return n;
  }
  return 0;
}

export function parseSheet(rows: string[][]): ParsedSheet {
  let incomeTotal = 0;
  let dollarRate = 0;
  let headerIndex = -1;
  const cols = {
    categoria: -1,
    concepto: -1,
    monto: -1,
    usd: -1,
    estado: -1,
    vencimiento: -1,
  };

  // 1. Buscar ingreso, dólar y la fila de encabezados.
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const joined = norm(row.join(' '));
    if (incomeTotal === 0 && joined.includes('ingreso total')) {
      incomeTotal = lastNumberInRow(row);
    }
    if (dollarRate === 0 && (joined.includes('dolar') || joined.includes('dólar'))) {
      dollarRate = lastNumberInRow(row);
    }
    if (headerIndex === -1 && joined.includes('concepto') && joined.includes('categor')) {
      headerIndex = r;
      row.forEach((cell, c) => {
        const n = norm(cell);
        if (n.includes('categor')) cols.categoria = c;
        else if (n.includes('concepto')) cols.concepto = c;
        else if (n.includes('monto')) cols.monto = c;
        else if (n.includes('usd')) cols.usd = c;
        else if (n.includes('estado')) cols.estado = c;
        else if (n.includes('vencim')) cols.vencimiento = c;
      });
    }
  }

  const result: ParsedRow[] = [];
  if (headerIndex === -1) return { incomeTotal, dollarRate, rows: result };

  // 2. Filas de datos hasta el pie (TOTAL UTILIZADO / RESTANTE).
  let lastCategoria = '';
  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const joined = norm(row.join(' '));
    if (joined.includes('total utilizado') || joined.includes('restante del mes')) break;

    const concepto = (row[cols.concepto] ?? '').trim();
    if (!concepto) continue;

    const categoria = (row[cols.categoria] ?? '').trim() || lastCategoria;
    if (categoria) lastCategoria = categoria;

    const monto = cols.monto >= 0 ? parseNumber(row[cols.monto]) : 0;
    const usd = cols.usd >= 0 ? parseNumber(row[cols.usd]) : 0;
    let amount = 0;
    let currency: 'UYU' | 'USD' = 'UYU';
    if (monto > 0) {
      amount = monto;
      currency = 'UYU';
    } else if (usd > 0) {
      amount = usd;
      currency = 'USD';
    }

    result.push({
      categoria: categoria || 'Sin categoría',
      concepto,
      amount,
      currency,
      status: parseStatus(row[cols.estado]),
      dueDate: parseDate(row[cols.vencimiento]),
    });
  }

  return { incomeTotal, dollarRate, rows: result };
}
