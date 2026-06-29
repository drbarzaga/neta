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

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
