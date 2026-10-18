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

/** { year, month, day } de "ahora" en una zona horaria IANA (ej. 'America/Montevideo'). */
export function nowInTimezone(timeZone: string, date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** True si year-month-day (calendario, sin hora) cae sábado o domingo. */
export function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dow === 0 || dow === 6;
}

/** Primer día hábil (lunes a viernes) del mes dado. No contempla feriados. */
export function firstBusinessDay(year: number, month: number): number {
  let day = 1;
  while (isWeekend(year, month, day)) day++;
  return day;
}

/** Cantidad de días del mes (1-12) dado. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Día del mes en que corresponde depositar el sueldo: el primer día hábil, o
 * un día fijo elegido por el usuario (corrido al día hábil siguiente si cae
 * en fin de semana). No contempla feriados, solo fines de semana.
 */
export function resolveSalaryDepositDay(
  year: number,
  month: number,
  dayMode: 'first_business_day' | 'fixed_day',
  fixedDay: number
): number {
  if (dayMode === 'first_business_day') return firstBusinessDay(year, month);
  const lastDay = daysInMonth(year, month);
  let day = Math.min(Math.max(1, fixedDay), lastDay);
  while (isWeekend(year, month, day) && day < lastDay) day++;
  return day;
}
