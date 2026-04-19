/** TRIMP score → 1–5 intensity dots. */
export function dotsForTrimp(v: number): number {
  if (v < 50) return 1;
  if (v < 100) return 2;
  if (v < 200) return 3;
  if (v < 400) return 4;
  return 5;
}

/** TRIMP per hour → 1–5 intensity dots. */
export function dotsForIntensity(perHour: number): number {
  if (perHour < 30) return 1;
  if (perHour < 60) return 2;
  if (perHour < 120) return 3;
  if (perHour < 180) return 4;
  return 5;
}
