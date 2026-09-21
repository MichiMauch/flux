// Zwei Personen, die gemeinsam unterwegs sind, zeichnen dieselbe Etappe
// doppelt auf. In einer geteilten Tour soll sie nur einmal erscheinen: mit
// den Werten der bevorzugten Person und den Fotos beider. Die Zuordnung
// passiert erst beim Lesen — gespeichert bleiben beide Mitgliedschaften,
// damit die andere Aufzeichnung nachrückt, wenn eine aus der Tour fliegt.

export interface MergeCandidate {
  id: string;
  userId: string;
  startTime: Date;
  duration: number | null;
  movingTime: number | null;
  routeData: { lat: number; lng: number }[] | null;
}

export interface MergedOuting<T> {
  primary: T;
  companions: T[];
}

/** Anteil der kürzeren Aufzeichnung, der zeitlich überlappen muss. */
const MIN_OVERLAP_RATIO = 0.5;
/** Maximaler Abstand der Startpunkte, wenn beide eine Route haben. */
const MAX_START_DISTANCE_M = 1000;

function interval(a: MergeCandidate): [number, number] | null {
  const secs = a.duration ?? a.movingTime;
  if (!secs || secs <= 0) return null;
  const start = new Date(a.startTime).getTime();
  return [start, start + secs * 1000];
}

function overlapRatio(a: MergeCandidate, b: MergeCandidate): number {
  const ia = interval(a);
  const ib = interval(b);
  if (!ia || !ib) return 0;
  const overlap = Math.min(ia[1], ib[1]) - Math.max(ia[0], ib[0]);
  if (overlap <= 0) return 0;
  return overlap / Math.min(ia[1] - ia[0], ib[1] - ib[0]);
}

function distanceMeters(
  p: { lat: number; lng: number },
  q: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(q.lat - p.lat);
  const dLng = toRad(q.lng - p.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p.lat)) * Math.cos(toRad(q.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function startsNearby(a: MergeCandidate, b: MergeCandidate): boolean {
  const pa = a.routeData?.[0];
  const pb = b.routeData?.[0];
  // Ohne Route auf einer Seite (Laufband, manueller Import) entscheidet die
  // Zeit allein.
  if (!pa || !pb) return true;
  return distanceMeters(pa, pb) <= MAX_START_DISTANCE_M;
}

/**
 * Fasst Aktivitäten verschiedener Personen zusammen, die dieselbe Etappe
 * sind. Aktivitäten von `primaryUserId` führen; jede Aktivität einer anderen
 * Person hängt sich an die am stärksten überlappende führende Aktivität. Was
 * keinen Partner findet, bleibt eine eigene Etappe. Die Reihenfolge der
 * Eingabe bleibt erhalten.
 */
export function mergeSameOutings<T extends MergeCandidate>(
  rows: T[],
  primaryUserId: string
): MergedOuting<T>[] {
  const leaders = rows.filter((r) => r.userId === primaryUserId);
  const companionsOf = new Map<string, T[]>();
  const absorbed = new Set<string>();

  for (const row of rows) {
    if (row.userId === primaryUserId) continue;
    let best: T | null = null;
    let bestRatio = 0;
    for (const leader of leaders) {
      const ratio = overlapRatio(leader, row);
      if (
        ratio >= MIN_OVERLAP_RATIO &&
        ratio > bestRatio &&
        startsNearby(leader, row)
      ) {
        best = leader;
        bestRatio = ratio;
      }
    }
    if (best) {
      absorbed.add(row.id);
      const list = companionsOf.get(best.id) ?? [];
      list.push(row);
      companionsOf.set(best.id, list);
    }
  }

  return rows
    .filter((r) => !absorbed.has(r.id))
    .map((r) => ({ primary: r, companions: companionsOf.get(r.id) ?? [] }));
}
