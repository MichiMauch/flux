/**
 * Streak helpers — derive training streaks from a set of active day keys
 * (YYYY-MM-DD). Shared by Bento streak card and coach context builder.
 */

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export function prevDayKey(key: string): string {
  const [y, m, dd] = key.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

/**
 * Length of the streak that ends today (or yesterday if today has no
 * activity yet). Zero if there's no recent activity.
 */
export function currentStreak(activeDays: Set<string>): number {
  let key = dayKey(new Date());
  if (!activeDays.has(key)) key = prevDayKey(key);
  let count = 0;
  while (activeDays.has(key)) {
    count += 1;
    key = prevDayKey(key);
  }
  return count;
}

export function longestStreak(activeDays: Set<string>): number {
  if (activeDays.size === 0) return 0;
  const sorted = Array.from(activeDays).sort();
  let longest = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] === prevDayKey(sorted[i])) {
      cur += 1;
      if (cur > longest) longest = cur;
    } else {
      cur = 1;
    }
  }
  return longest;
}

/**
 * How many calendar days (0-based) since the most recent active day.
 * Returns null if there are no active days.
 */
export function daysSinceLastActive(activeDays: Set<string>): number | null {
  if (activeDays.size === 0) return null;
  const today = dayKey(new Date());
  if (activeDays.has(today)) return 0;
  let key = prevDayKey(today);
  let days = 1;
  while (days < 365) {
    if (activeDays.has(key)) return days;
    key = prevDayKey(key);
    days += 1;
  }
  return null;
}
