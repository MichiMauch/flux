export { dotsForTrimp, dotsForIntensity } from "@/lib/activity-metrics";

/** Locale-aware number formatter with a fallback dash for null/NaN. */
export function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return n.toLocaleString("de-CH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Meters → km string with 2 decimals, or "–". */
export function km(m: number | null): string {
  if (m == null) return "–";
  return (m / 1000).toFixed(2);
}

/** Darken a #hex color by 30% (for the dimmed accent). */
export function dimColor(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = Math.round(parseInt(full.slice(0, 2), 16) * 0.7);
  const g = Math.round(parseInt(full.slice(2, 4), 16) * 0.7);
  const b = Math.round(parseInt(full.slice(4, 6), 16) * 0.7);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
