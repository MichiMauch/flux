import OpenAI from "openai";
import { reverseGeocode } from "./geocode";

const MODEL = "gpt-4o-mini";
const LOOP_THRESHOLD_M = 200;

export interface RoutePoint {
  lat: number;
  lng: number;
  time?: string;
}

export interface ActivityTitleContext {
  type: string;
  subType?: string | null;
  startTime: Date;
  distanceMeters: number | null;
  durationSeconds: number | null;
  ascentMeters: number | null;
  routeData: RoutePoint[] | null;
  fallbackTitle: string;
}

function haversine(a: RoutePoint, b: RoutePoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function detectLoop(route: RoutePoint[]): boolean {
  if (route.length < 2) return false;
  const d = haversine(route[0], route[route.length - 1]);
  return d < LOOP_THRESHOLD_M;
}

function farthestPoint(route: RoutePoint[]): RoutePoint | null {
  if (route.length < 2) return null;
  const start = route[0];
  let maxD = 0;
  let far: RoutePoint | null = null;
  for (const p of route) {
    const d = haversine(start, p);
    if (d > maxD) {
      maxD = d;
      far = p;
    }
  }
  return maxD > 500 ? far : null;
}

function timeOfDay(date: Date): string {
  const h = date.getHours();
  if (h >= 5 && h < 10) return "Morgen";
  if (h >= 10 && h < 12) return "Vormittag";
  if (h >= 12 && h < 14) return "Mittag";
  if (h >= 14 && h < 18) return "Nachmittag";
  if (h >= 18 && h < 22) return "Abend";
  return "Nacht";
}

const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

function typeLabel(type: string, subType?: string | null): string {
  const t = `${type} ${subType ?? ""}`.toUpperCase();
  if (t.includes("ROAD") && (t.includes("CYCL") || t.includes("BIK"))) return "Rennrad";
  if (t.includes("MOUNTAIN") && (t.includes("CYCL") || t.includes("BIK"))) return "Mountainbike";
  if (t.includes("CYCL") || t.includes("BIK") || t.includes("RIDE")) return "Velo";
  if (t.includes("TREK")) return "Wanderung";
  if (t === "HIKING" || t.includes("HIK")) return "Wanderung";
  if (t.includes("WALK")) return "Spaziergang";
  if (t.includes("RUN") || t.includes("JOG")) return "Lauf";
  if (t.includes("SWIM")) return "Schwimmen";
  return "Training";
}

export async function generateActivityTitle(
  ctx: ActivityTitleContext
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return ctx.fallbackTitle;

  try {
    const route = ctx.routeData ?? [];
    const validRoute = route.filter((p) => p.lat != null && p.lng != null);

    let startLoc: string | null = null;
    let endLoc: string | null = null;
    let farLoc: string | null = null;
    let loop = false;

    if (validRoute.length >= 2) {
      loop = detectLoop(validRoute);
      startLoc = await reverseGeocode(validRoute[0].lat, validRoute[0].lng);
      if (!loop) {
        const last = validRoute[validRoute.length - 1];
        endLoc = await reverseGeocode(last.lat, last.lng);
      }
      const far = farthestPoint(validRoute);
      if (far && !loop) {
        farLoc = await reverseGeocode(far.lat, far.lng);
      } else if (far && loop) {
        farLoc = await reverseGeocode(far.lat, far.lng);
      }
    }

    const prompt = {
      typ: typeLabel(ctx.type, ctx.subType),
      start: startLoc,
      ende: loop ? null : endLoc,
      entferntester_ort: farLoc && farLoc !== startLoc && farLoc !== endLoc ? farLoc : null,
      ist_loop: loop,
      distanz_km:
        ctx.distanceMeters != null
          ? Math.round((ctx.distanceMeters / 1000) * 10) / 10
          : null,
      dauer_min:
        ctx.durationSeconds != null
          ? Math.round(ctx.durationSeconds / 60)
          : null,
      aufstieg_m:
        ctx.ascentMeters != null && ctx.ascentMeters > 0
          ? Math.round(ctx.ascentMeters)
          : null,
      tageszeit: timeOfDay(ctx.startTime),
      wochentag: WEEKDAYS[ctx.startTime.getDay()],
    };

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 40,
      messages: [
        {
          role: "system",
          content:
            'Du bist ein kreativer Titel-Generator für Fitness-Aktivitäten. ' +
            'Erzeuge einen kurzen, einprägsamen deutschen Titel (max 60 Zeichen) basierend auf den JSON-Daten. ' +
            'Nutze, wenn sinnvoll, Ortsnamen. Bei Loop nur den Startort. Bei Point-to-Point "Start–Ziel". ' +
            'Keine Anführungszeichen, keine Emojis, kein Datum. ' +
            'Beispiele: "Spaziergang in Muhen" — "Rennrad-Tour Muhen–Williberg–Reitnau" — "Morgenlauf durch den Wald" — "Abendliche Wanderung auf dem Aargauer Weg".',
        },
        { role: "user", content: JSON.stringify(prompt) },
      ],
    });

    const title = response.choices?.[0]?.message?.content?.trim();
    if (!title) return ctx.fallbackTitle;

    // Strip surrounding quotes if the model added them
    const cleaned = title.replace(/^["'«»]+|["'«»]+$/g, "").trim();
    if (cleaned.length === 0 || cleaned.length > 80) return ctx.fallbackTitle;
    return cleaned;
  } catch (e) {
    console.warn("AI title generation failed:", e);
    return ctx.fallbackTitle;
  }
}

const KNOWN_DETAILED_SPORTS = [
  "WALKING",
  "HIKING",
  "RUNNING",
  "CYCLING",
  "ROAD_BIKING",
  "MOUNTAIN_BIKING",
  "FITNESS_WALKING",
  "NORDIC_WALKING",
  "POWER_WALKING",
  "JOGGING",
  "SWIMMING",
  "TREKKING",
];

/**
 * Normalize Polar sport + detailed_sport_info into a meaningful type.
 * When Polar sends sport=OTHER but detailed info is a known sport, prefer it.
 */
export function normalizePolarType(
  sport: string | null | undefined,
  detailed: string | null | undefined
): string {
  const s = (sport ?? "").toUpperCase().trim();
  const d = (detailed ?? "").toUpperCase().trim();
  if (s && s !== "OTHER") return s;
  if (d && KNOWN_DETAILED_SPORTS.includes(d)) return d;
  // Fuzzy match on detailed
  if (d.includes("WALK")) return "WALKING";
  if (d.includes("HIK") || d.includes("TREK")) return "HIKING";
  if (d.includes("RUN") || d.includes("JOG")) return "RUNNING";
  if (d.includes("CYCL") || d.includes("BIK")) return "CYCLING";
  return s || "OTHER";
}

export function isGenericTitle(name: string, type: string): boolean {
  const trimmed = name.trim();
  const upper = trimmed.toUpperCase();
  const typeUpper = type.trim().toUpperCase();
  if (upper === typeUpper) return true;
  if (upper === "WALKING") return true;
  if (upper === "HIKING") return true;
  if (upper === "RUNNING") return true;
  if (upper === "CYCLING") return true;
  if (upper === "OTHER") return true;
  if (upper === "OTHER_OUTDOOR") return true;
  if (upper === "TRAINING") return true;
  // Sport-Info-Style wie "CYCLING (road)"
  if (/^[A-Z_]+ \([a-z_]+\)$/.test(trimmed)) return true;
  // Ältere AI-Fallback-Titel mit "Training"
  if (/training/i.test(trimmed)) return true;
  return false;
}
