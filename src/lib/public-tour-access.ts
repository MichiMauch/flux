import { timingSafeEqual } from "crypto";

// Zugang für externe Websites (z. B. Grenzgänger) zu ausgewählten Touren.
// Statt eines öffentlichen Share-Links: ein fester Schlüssel, den nur der
// Server der Website kennt, und eine Liste der Touren, die er sehen darf.
//
//   PUBLIC_TOUR_API_KEY  Bearer-Schlüssel der Website
//   PUBLIC_TOUR_IDS      kommagetrennte Tour-IDs, die herausgegeben werden

export function schluesselOk(request: Request): boolean {
  const expected = process.env.PUBLIC_TOUR_API_KEY;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const got = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function tourFreigegeben(tourId: string): boolean {
  return (process.env.PUBLIC_TOUR_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(tourId);
}
