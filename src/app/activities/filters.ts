export function parseSport(v: string | undefined | null): string | null {
  if (!v || v === "all") return null;
  return v;
}

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseMonthKey(v: string | undefined | null): string | null {
  if (!v) return null;
  return MONTH_KEY_RE.test(v) ? v : null;
}

export function monthKeyRange(
  v: string | null
): { start: Date; end: Date } | null {
  if (!v) return null;
  const m = MONTH_KEY_RE.exec(v);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const start = new Date(Date.UTC(y, mo - 1, 1));
  const end = new Date(Date.UTC(mo === 12 ? y + 1 : y, mo === 12 ? 0 : mo, 1));
  return { start, end };
}

export function sportLottie(type: string): string | null {
  const t = type.toUpperCase();
  if (t === "RUNNING" || t === "TRAIL_RUNNING") return "running";
  if (
    t === "CYCLING" ||
    t === "ROAD_BIKING" ||
    t === "MOUNTAIN_BIKING" ||
    t === "INDOOR_CYCLING"
  )
    return "bicycle";
  if (t === "WALKING") return "walk";
  if (t === "HIKING" || t === "SNOWSHOE_TREKKING") return "hiking";
  if (t === "YOGA" || t === "PILATES") return "yoga-pose";
  return null;
}
