/**
 * Date-range helpers. Week starts on Monday (ISO).
 */

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = (day + 6) % 7; // Mon=0, Sun=6
  d.setDate(d.getDate() - diff);
  return d;
}

export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

export function currentWeekRange(now: Date = new Date()): { from: Date; to: Date } {
  return { from: startOfWeek(now), to: endOfWeek(now) };
}

export function monthRange(year: number, month: number): { from: Date; to: Date } {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);
  return { from, to };
}

/** Returns ISO 8601 week number for a given date. */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}

/** Key for grouping activities by day: YYYY-MM-DD (local time). */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseMonthParam(value: string | undefined, fallback: Date = new Date()): {
  year: number;
  month: number;
} {
  if (value) {
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      if (year > 1900 && year < 3000 && month >= 0 && month <= 11) {
        return { year, month };
      }
    }
  }
  return { year: fallback.getFullYear(), month: fallback.getMonth() };
}

export function formatMonthParam(year: number, month: number): string {
  return `${year}-${(month + 1).toString().padStart(2, "0")}`;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
