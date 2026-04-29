import OpenAI from "openai";
import { reverseGeocode } from "./geocode";

// Inlined to avoid pulling in `server-only` (which Next.js bundles but tsx
// scripts can't resolve). Keep model in sync with src/lib/openai.ts.
const DEFAULT_MODEL = "gpt-5.4-mini";
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const LOOP_THRESHOLD_M = 200;
const WAYPOINT_SAMPLES = 6;

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

/**
 * Sample N points evenly distributed by cumulative travel distance, including
 * first and last points. Returns up to N entries; fewer if route is short.
 */
function sampleByDistance(route: RoutePoint[], n: number): RoutePoint[] {
  if (route.length <= n) return [...route];

  const cum: number[] = [0];
  for (let i = 1; i < route.length; i++) {
    cum.push(cum[i - 1] + haversine(route[i - 1], route[i]));
  }
  const total = cum[cum.length - 1];
  if (total < 100) return [route[0], route[route.length - 1]];

  const out: RoutePoint[] = [];
  for (let s = 0; s < n; s++) {
    const target = (s / (n - 1)) * total;
    // binary search for first index with cum >= target
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    out.push(route[lo]);
  }
  return out;
}

/** Strip the ", Region/Country" suffix added by reverseGeocode for chain display. */
function placeOnly(loc: string | null | undefined): string | null {
  if (!loc) return null;
  return loc.split(",")[0].trim();
}

/** Deduplicate consecutive identical place names. */
function uniqueChain(items: (string | null)[]): string[] {
  const out: string[] = [];
  for (const x of items) {
    if (!x) continue;
    if (out.length === 0 || out[out.length - 1] !== x) out.push(x);
  }
  return out;
}

export async function generateActivityTitle(
  ctx: ActivityTitleContext
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[ai-title] OPENAI_API_KEY missing — using fallback");
    return ctx.fallbackTitle;
  }

  try {
    const route = (ctx.routeData ?? []).filter(
      (p) => p.lat != null && p.lng != null
    );
    const loop = detectLoop(route);

    let chain: string[] = [];
    let startFull: string | null = null;
    let endFull: string | null = null;

    if (route.length >= 2) {
      const samples = sampleByDistance(route, WAYPOINT_SAMPLES);
      const geocoded = await Promise.all(
        samples.map((p) => reverseGeocode(p.lat, p.lng))
      );
      startFull = geocoded[0];
      endFull = geocoded[geocoded.length - 1];
      chain = uniqueChain(geocoded.map(placeOnly));
    }

    const prompt = {
      orte_kette: chain,
      start: startFull,
      ende: loop ? null : endFull,
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
    };

    const openai = getOpenAIClient();

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      max_completion_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            "Du bist ein Titel-Generator für Fitness-Aktivitäten. " +
            "Erzeuge einen kurzen deutschen Titel (max 60 Zeichen), der ausschliesslich auf Ortsnamen basiert. " +
            "Die Sportart wird in der UI über Icon/Farbe angezeigt — daher KEINE Sportart im Titel nennen. " +
            "Regeln: " +
            "(1) Verwende ausschliesslich Ortsnamen aus 'orte_kette'. " +
            "(2) Bei mehreren Orten: Kette 'Ort1–Ort2–Ort3' mit Halbgeviertstrich – (max 4 Orte, kürze sinnvoll). " +
            "(3) Bei Loop und nur einem Ort: 'Runde um <Ort>' oder einfach '<Ort>'. " +
            "(4) Bei Point-to-Point: 'Start–Ziel'. " +
            "(5) NIEMALS Sportart-Wörter wie 'Velo', 'Rennrad', 'Mountainbike', 'Lauf', 'Wanderung', 'Spaziergang', 'Schwimmen', 'Tour', 'Training', 'Runde' (ausser Regel 3). " +
            "(6) NIEMALS Tageszeit-Wörter ('Morgen', 'Mittag', 'Abend', 'Nacht', 'morgendlich' etc.). " +
            "(7) Kein Wochentag, kein Datum, keine Anführungszeichen, keine Emojis. " +
            "(8) Wenn 'orte_kette' leer ist: gib einen leeren String zurück. " +
            "Beispiele: 'Muhen–Williberg–Reitnau' — 'Brienz–Rothorn' — 'Runde um Muhen' — 'Aarau'.",
        },
        { role: "user", content: JSON.stringify(prompt) },
      ],
    });

    const title = response.choices?.[0]?.message?.content?.trim();
    if (!title) {
      console.warn("[ai-title] Empty response from OpenAI", {
        model: DEFAULT_MODEL,
        finishReason: response.choices?.[0]?.finish_reason,
      });
      return ctx.fallbackTitle;
    }

    const cleaned = title.replace(/^["'«»]+|["'«»]+$/g, "").trim();
    if (cleaned.length === 0 || cleaned.length > 80) {
      console.warn("[ai-title] Cleaned title invalid", { raw: title, cleaned });
      return ctx.fallbackTitle;
    }
    return cleaned;
  } catch (e) {
    const err = e as { status?: number; message?: string; code?: string };
    console.warn("[ai-title] OpenAI call failed", {
      model: DEFAULT_MODEL,
      status: err?.status,
      code: err?.code,
      message: err?.message,
    });
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
  if (d.includes("WALK")) return "WALKING";
  if (d.includes("HIK") || d.includes("TREK")) return "HIKING";
  if (d.includes("RUN") || d.includes("JOG")) return "RUNNING";
  if (d.includes("CYCL") || d.includes("BIK")) return "CYCLING";
  return s || "OTHER";
}

const TIME_OF_DAY_RE =
  /\b(morgen|mittag|nachmittag|abend|nacht|morgendlich|abendlich|nächtlich|frühlauf|frühtour|abendtour|morgentour|mittagstour|nachmittags|abends|morgens|mittags)\b/i;

export function isGenericTitle(name: string, type: string): boolean {
  const trimmed = name.trim();
  const upper = trimmed.toUpperCase();
  const typeUpper = type.trim().toUpperCase();
  if (upper === typeUpper) return true;
  if (KNOWN_DETAILED_SPORTS.includes(upper)) return true;
  if (upper === "OTHER") return true;
  if (upper === "OTHER_OUTDOOR") return true;
  if (upper === "TRAINING") return true;
  if (/^[A-Z_]+ \([a-z_]+\)$/.test(trimmed)) return true;
  if (/training/i.test(trimmed)) return true;
  // Treat any title with time-of-day phrases as generic so backfill rewrites it.
  if (TIME_OF_DAY_RE.test(trimmed)) return true;
  return false;
}
