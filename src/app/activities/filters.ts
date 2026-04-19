export function parseSport(v: string | undefined | null): string | null {
  if (!v || v === "all") return null;
  return v;
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
