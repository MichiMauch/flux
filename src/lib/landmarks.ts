// Named alpine landmarks (peaks, huts, passes, saddles) along a route, from
// OpenStreetMap via the Overpass API.
//
// Why this exists: Mapbox reverse geocoding (see geocode.ts) only knows
// settlements and regions. On a mountain tour every waypoint geocodes to the
// same valley/village, so the AI title collapses to a single coarse name
// ("Pitztal"). The features that actually describe the tour — Almen, Gipfel,
// Joche — live only in OSM. We fetch them here and feed them into ai-title.ts.

export type LandmarkKind = "peak" | "alpine_hut" | "pass" | "saddle";

export interface Landmark {
  name: string;
  kind: LandmarkKind;
  lat: number;
  lng: number;
  ele: number | null;
}

interface RoutePoint {
  lat: number;
  lng: number;
}

// Public Overpass mirrors, tried in order until one answers. The main instance
// is occasionally overloaded (504), so we fall through to the mirrors.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// How close (metres) the track must pass a feature to count as "visited".
// Peaks/passes/saddles you cross directly → tight. Huts/Almen you stop at,
// often a little off the ideal line, and the POI node may sit at the building
// rather than the trail → wider.
const PEAK_RADIUS_M = 150;
const HUT_RADIUS_M = 400;
// Cap the polyline sent to Overpass; segments between vertices still match, so
// this is only about query size, not coverage.
const MAX_QUERY_POINTS = 120;

// Names that mean "Alm/Hütte" but where the OSM feature is NOT tagged as an
// alpine_hut (e.g. amenity=restaurant "Arzler Alm" / "Mauchelealm",
// tourism=information "Tiefental Alm"). Matched against the feature name.
// "alm/alp/hütte" count as a standalone word OR a compound suffix
// ("Söllbergalm", "Riffelseehütte") — the trailing \b anchors the word end.
const HUT_NAME_RE = /(alm|alp|alpe|h[üu]tt?e)\b/i;
// Reject ways/features named after an Alm that are really paths, lifts, water,
// etc. ("Arzler Alm-Weg", "Almbahn", "Almbach").
const NOT_A_PLACE_RE = /(weg|str(?:\.|aße|asse)|pfad|steig|bahn|lift|bach|graben|route)$/i;
// Give up on a slow Overpass rather than stalling the upload/sync.
const OVERPASS_TIMEOUT_MS = 12000;

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
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

/** Evenly pick up to n points by index (keeps first and last). */
function sampleEvenly(route: RoutePoint[], n: number): RoutePoint[] {
  if (route.length <= n) return route;
  const out: RoutePoint[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i / (n - 1)) * (route.length - 1));
    out.push(route[idx]);
  }
  return out;
}

/** Index of the route vertex closest to a landmark — used to order landmarks along the route. */
function nearestIndex(route: RoutePoint[], p: RoutePoint): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < route.length; i++) {
    const d = haversine(route[i], p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function classify(tags: Record<string, string>): LandmarkKind | null {
  if (tags.mountain_pass === "yes") return "pass";
  if (tags.natural === "peak") return "peak";
  if (tags.natural === "saddle") return "saddle";
  if (tags.tourism === "alpine_hut") return "alpine_hut";
  // Alm/Hütte by name, but not roads/lifts/waterways.
  const name = tags.name;
  if (
    name &&
    !tags.highway &&
    !tags.waterway &&
    !tags.route &&
    HUT_NAME_RE.test(name) &&
    !NOT_A_PLACE_RE.test(name)
  ) {
    return "alpine_hut";
  }
  return null;
}

const OVERPASS_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function queryOverpass(query: string): Promise<OverpassElement[] | null> {
  // The public Overpass instances 504 under load fairly often, so retry a few
  // rounds and rotate through mirrors before giving up.
  for (let attempt = 0; attempt < OVERPASS_ATTEMPTS; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            // Overpass rejects requests without a User-Agent (HTTP 406).
            "User-Agent": "flux/1.0 (activity-title-landmarks)",
          },
          body: "data=" + encodeURIComponent(query),
          cache: "no-store",
          signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as { elements?: OverpassElement[] };
        return data.elements ?? [];
      } catch {
        // try next mirror / next attempt
      }
    }
    if (attempt < OVERPASS_ATTEMPTS - 1) await sleep(1500 * (attempt + 1));
  }
  console.warn("[landmarks] all Overpass endpoints failed/timed out");
  return null;
}

/**
 * Find named peaks, alpine huts, passes and saddles within SEARCH_RADIUS_M of
 * the route, ordered by where they occur along the track. Deduplicated by name.
 * Returns [] when the route is too short, nothing is nearby, or Overpass fails
 * — callers fall back to settlement names.
 */
export async function findRouteLandmarks(
  route: RoutePoint[]
): Promise<Landmark[]> {
  const clean = route.filter((p) => p.lat != null && p.lng != null);
  if (clean.length < 2) return [];

  const pts = sampleEvenly(clean, MAX_QUERY_POINTS);
  const coords = pts.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(",");
  const peakAround = `around:${PEAK_RADIUS_M},${coords}`;
  const hutAround = `around:${HUT_RADIUS_M},${coords}`;
  const query =
    `[out:json][timeout:25];(` +
    `node(${peakAround})[natural=peak];` +
    `node(${peakAround})[natural=saddle];` +
    `node(${peakAround})[mountain_pass=yes];` +
    `nwr(${hutAround})[tourism=alpine_hut];` +
    // Almen/Hütten tagged as restaurant/information/… but named "… Alm/Hütte".
    `nwr(${hutAround})[name~"[Aa]lm|[Aa]lp|[Hh]ütte"][!highway][!waterway][!route];` +
    `);out center;`;

  const elements = await queryOverpass(query);
  if (!elements) return [];

  const raw: Landmark[] = [];
  for (const e of elements) {
    const name = e.tags?.name?.trim();
    if (!name || !e.tags) continue;
    const kind = classify(e.tags);
    if (!kind) continue;
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (lat == null || lng == null) continue;
    const ele = e.tags.ele ? Number.parseInt(e.tags.ele, 10) : null;
    raw.push({ name, kind, lat, lng, ele: Number.isFinite(ele!) ? ele : null });
  }

  // Order by position along the route, dedup by name (keep first occurrence).
  const ordered = raw
    .map((l) => ({ l, idx: nearestIndex(clean, l) }))
    .sort((a, b) => a.idx - b.idx);

  const seen = new Set<string>();
  const result: Landmark[] = [];
  for (const { l } of ordered) {
    if (seen.has(l.name)) continue;
    seen.add(l.name);
    result.push(l);
  }
  return result;
}

// ── Endpoint POIs ──────────────────────────────────────────────────────────
// Route-wide landmarks (above) only know peaks/passes/huts/Almen. A point-to-
// point tour whose DESTINATION is a named POI of another kind — a mountain
// hotel/hospiz ("Grimsel Hospiz"), a reservoir/lake ("Grimselsee"), an isolated
// dwelling — loses that name: Mapbox geocodes the whole valley to one
// municipality ("Guttannen") and the route-wide query ignores hotels/lakes.
// So we run a tight query around JUST the start and end points and pick the
// single most destination-worthy named feature at each, to override the coarse
// settlement name in the title.

const ENDPOINT_RADIUS_M = 200;

/** Score a feature by how much it reads as a tour destination. 0 = ignore. */
function endpointPoiScore(t: Record<string, string>): number {
  if (t.tourism === "alpine_hut" || t.tourism === "wilderness_hut") return 100;
  if (t.mountain_pass === "yes") return 90;
  if (t.natural === "peak") return 85;
  if (t.natural === "saddle") return 80;
  if (t.tourism === "hotel" || t.tourism === "hostel" || t.tourism === "guest_house" || t.tourism === "chalet") return 70;
  if (t.natural === "water" || t.natural === "glacier") return 60;
  if (t.tourism === "viewpoint" || t.tourism === "attraction") return 50;
  if (t.place === "isolated_dwelling" || t.place === "hamlet" || t.place === "locality") return 40;
  return 0;
}

export interface EndpointPois {
  start: string | null;
  end: string | null;
}

/**
 * Best destination-worthy POI name within ENDPOINT_RADIUS_M of the start and end
 * points. Returns null for an endpoint with nothing notable nearby (e.g. a
 * village trailhead) so the caller keeps the settlement name there.
 */
export async function findEndpointPois(
  start: RoutePoint,
  end: RoutePoint
): Promise<EndpointPois> {
  const around = `around:${ENDPOINT_RADIUS_M},${start.lat.toFixed(5)},${start.lng.toFixed(5)},${end.lat.toFixed(5)},${end.lng.toFixed(5)}`;
  const query =
    `[out:json][timeout:25];(` +
    `nwr(${around})[tourism~"^(alpine_hut|wilderness_hut|hotel|hostel|guest_house|chalet|viewpoint|attraction)$"][name];` +
    `node(${around})[mountain_pass=yes][name];` +
    `node(${around})[natural~"^(peak|saddle)$"][name];` +
    `nwr(${around})[natural~"^(water|glacier)$"][name];` +
    `node(${around})[place~"^(isolated_dwelling|hamlet|locality)$"][name];` +
    `);out center tags;`;

  const elements = await queryOverpass(query);
  if (!elements) return { start: null, end: null };

  const candidates: { name: string; score: number; lat: number; lng: number }[] = [];
  for (const e of elements) {
    const name = e.tags?.name?.trim();
    if (!name || !e.tags) continue;
    const score = endpointPoiScore(e.tags);
    if (score === 0) continue;
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (lat == null || lng == null) continue;
    candidates.push({ name, score, lat, lng });
  }

  // Pick the best (highest score, then closest) candidate for each endpoint.
  const pick = (p: RoutePoint): string | null => {
    let best: { name: string; score: number; d: number } | null = null;
    for (const c of candidates) {
      const d = haversine(p, c);
      if (d > ENDPOINT_RADIUS_M) continue;
      if (!best || c.score > best.score || (c.score === best.score && d < best.d)) {
        best = { name: c.name, score: c.score, d };
      }
    }
    return best?.name ?? null;
  };

  return { start: pick(start), end: pick(end) };
}
