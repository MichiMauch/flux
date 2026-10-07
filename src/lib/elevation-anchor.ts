/**
 * Relative Höhen der Pixel Watch auf Meereshöhe verankern.
 *
 * Die Uhr liefert im TCX bei vielen Aufzeichnungen keine Meereshöhe, sondern
 * eine relative Höhe, die beim Start bei 0 m beginnt. Von 31 Google-Aktivitäten
 * zwischen dem 7.9. und 7.10.2026 waren 24 so verschoben (Start zu Hause bei
 * 427 m, im Track 0 m). Der Verlauf stimmt, nur der Sockel fehlt — Aufstieg und
 * Abstieg sind deshalb korrekt, Höchst- und Tiefstwert nicht.
 *
 * Abgleich: Stichproben des Tracks gegen ein Höhenmodell, der Median der
 * Differenzen ist der Versatz. Der Median, weil einzelne Punkte unter Brücken,
 * im Wald oder neben Felskanten im Modell danebenliegen.
 *
 *   Schweiz   swisstopo (api3.geo.admin.ch/rest/services/height), genauer,
 *             aber nur ein Punkt pro Aufruf und nur LV95/LV03
 *   sonst     Open-Meteo Elevation (Copernicus DEM 90 m), bis 100 Punkte
 *             pro Aufruf, weltweit
 *
 * Schlägt der Abgleich fehl, bleibt der Track unverändert. Eine Aktivität
 * fällt nie wegen eines Höhendienstes aus dem Import.
 */

interface ElevationPoint {
  lat: number;
  lng: number;
  elevation?: number;
}

export type ElevationAnchorSource = "swisstopo" | "open-meteo";

export interface ElevationAnchor {
  /** Meter, die auf jede Höhe im Track addiert werden. */
  offset: number;
  source: ElevationAnchorSource;
  /** Anzahl Stichproben, aus denen der Median gebildet wurde. */
  samples: number;
}

// Unterhalb dieses Versatzes bleibt der Track, wie er ist. Absolut
// aufgezeichnete Tracks weichen vom Modell um einige Meter ab (Barometer,
// Wetter, Modellauflösung) — die sollen nicht um 3 m hin- und hergeschoben
// werden. Die relativen Tracks liegen um mehrere hundert Meter daneben.
const MIN_OFFSET_M = 25;

const SWISSTOPO_SAMPLES = 30;
const SWISSTOPO_CONCURRENCY = 6;
const OPEN_METEO_SAMPLES = 100;
// Weniger gültige Stichproben als das ergeben keinen belastbaren Median.
const MIN_VALID_SAMPLES = 10;
const REQUEST_TIMEOUT_MS = 8000;

// Grobe Hülle der Schweiz. Grenznahe Punkte in Nachbarländern fallen mit
// hinein; die swisstopo-API antwortet dort mit "out of bounds" und der Punkt
// zählt nicht. Bleiben zu wenige übrig, übernimmt Open-Meteo.
const CH_BOUNDS = { minLat: 45.8, maxLat: 47.85, minLng: 5.9, maxLng: 10.55 };

function inSwitzerland(p: ElevationPoint): boolean {
  return (
    p.lat >= CH_BOUNDS.minLat &&
    p.lat <= CH_BOUNDS.maxLat &&
    p.lng >= CH_BOUNDS.minLng &&
    p.lng <= CH_BOUNDS.maxLng
  );
}

/**
 * WGS84 → LV95 nach den Näherungsformeln von swisstopo. Genauigkeit rund 1 m,
 * für eine Höhenabfrage mehr als genug.
 */
export function wgs84ToLv95(lat: number, lng: number): { e: number; n: number } {
  const p = (lat * 3600 - 169028.66) / 10000;
  const l = (lng * 3600 - 26782.5) / 10000;
  const e =
    2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l ** 3;
  const n =
    1200147.07 +
    308807.95 * p +
    3745.25 * l * l +
    76.63 * p * p -
    194.56 * l * l * p +
    119.79 * p ** 3;
  return { e, n };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Bis zu `n` gleichmässig über den Track verteilte Punkte. */
function sample<T>(points: T[], n: number): T[] {
  if (points.length <= n) return points.slice();
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(points[Math.floor((i * (points.length - 1)) / (n - 1))]);
  }
  return out;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function swisstopoHeight(p: ElevationPoint): Promise<number | null> {
  const { e, n } = wgs84ToLv95(p.lat, p.lng);
  const url = `https://api3.geo.admin.ch/rest/services/height?easting=${e.toFixed(1)}&northing=${n.toFixed(1)}&sr=2056`;
  try {
    const data = (await fetchJson(url)) as { height?: string | number };
    const h = Number(data?.height);
    return Number.isFinite(h) ? h : null;
  } catch {
    // Ausserhalb der Landesgrenze (HTTP 400 "out of bounds") oder Netzfehler:
    // dieser Punkt zählt einfach nicht.
    return null;
  }
}

/** Höhen in der Reihenfolge der Punkte, `null` wo swisstopo nichts liefert. */
async function swisstopoHeights(points: ElevationPoint[]): Promise<(number | null)[]> {
  const out: (number | null)[] = new Array(points.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < points.length) {
      const i = next++;
      out[i] = await swisstopoHeight(points[i]);
    }
  }
  await Promise.all(Array.from({ length: SWISSTOPO_CONCURRENCY }, worker));
  return out;
}

async function openMeteoHeights(points: ElevationPoint[]): Promise<(number | null)[]> {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat.toFixed(5)).join(","),
    longitude: points.map((p) => p.lng.toFixed(5)).join(","),
  });
  const data = (await fetchJson(
    `https://api.open-meteo.com/v1/elevation?${params}`
  )) as { elevation?: unknown[] };
  const list = Array.isArray(data?.elevation) ? data.elevation : [];
  return points.map((_, i) => {
    const h = Number(list[i]);
    return Number.isFinite(h) ? h : null;
  });
}

function offsetFrom(
  points: ElevationPoint[],
  heights: (number | null)[]
): { offset: number; samples: number } | null {
  const diffs: number[] = [];
  points.forEach((p, i) => {
    const h = heights[i];
    if (h != null && p.elevation != null) diffs.push(h - p.elevation);
  });
  if (diffs.length < MIN_VALID_SAMPLES) return null;
  return { offset: median(diffs), samples: diffs.length };
}

/**
 * Versatz zwischen Track und Höhenmodell bestimmen. Gibt `null` zurück, wenn
 * kein Abgleich möglich war — nicht, wenn der Versatz klein ist. Ob verschoben
 * wird, entscheidet `applyElevationAnchor`.
 */
export async function findElevationAnchor(
  route: ElevationPoint[] | null | undefined
): Promise<ElevationAnchor | null> {
  if (!route) return null;
  const withElevation = route.filter(
    (p) =>
      typeof p.elevation === "number" &&
      Number.isFinite(p.elevation) &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng)
  );
  if (withElevation.length < MIN_VALID_SAMPLES) return null;

  const swissShare =
    withElevation.filter(inSwitzerland).length / withElevation.length;

  if (swissShare >= 0.5) {
    const pts = sample(withElevation.filter(inSwitzerland), SWISSTOPO_SAMPLES);
    const result = offsetFrom(pts, await swisstopoHeights(pts));
    if (result) return { ...result, source: "swisstopo" };
  }

  try {
    const pts = sample(withElevation, OPEN_METEO_SAMPLES);
    const result = offsetFrom(pts, await openMeteoHeights(pts));
    if (result) return { ...result, source: "open-meteo" };
  } catch (e) {
    console.warn("[elevation-anchor] Open-Meteo fehlgeschlagen:", e);
  }
  return null;
}

/**
 * Track um den Versatz verschieben, falls er gross genug ist. Gibt den neuen
 * Track zurück oder `null`, wenn nichts zu tun ist.
 */
export function applyElevationAnchor<T extends ElevationPoint>(
  route: T[],
  anchor: ElevationAnchor | null
): T[] | null {
  if (!anchor || Math.abs(anchor.offset) < MIN_OFFSET_M) return null;
  const offset = Math.round(anchor.offset * 10) / 10;
  return route.map((p) =>
    typeof p.elevation === "number"
      ? { ...p, elevation: Math.round((p.elevation + offset) * 10) / 10 }
      : p
  );
}
