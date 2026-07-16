export const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** "Marzo de 2026" a partir de mes (1-12) y año. */
export function periodLabel(month: number, year: number): string {
  return `${MONTHS_ES[month - 1] ?? '?'} de ${year}`;
}

/** Devuelve { month, year } del mes siguiente. */
export function nextMonth(month: number, year: number) {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

/** Suma `n` meses (n puede ser negativo) y devuelve { month, year }. */
export function addMonths(month: number, year: number, n: number) {
  const zero = year * 12 + (month - 1) + n;
  return { month: (((zero % 12) + 12) % 12) + 1, year: Math.floor(zero / 12) };
}

/** Cuántos meses hay de (fromMonth/fromYear) a (toMonth/toYear). */
export function monthDiff(
  fromMonth: number,
  fromYear: number,
  toMonth: number,
  toYear: number
): number {
  return toYear * 12 + (toMonth - 1) - (fromYear * 12 + (fromMonth - 1));
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Lista de fechas ISO (YYYY-MM-DD) entre `start` y `end`, ambas incluidas. */
export function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cur.getTime() <= last.getTime()) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
