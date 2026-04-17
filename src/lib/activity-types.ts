export function activityTypeLabel(type: string): string {
  const t = type.toUpperCase();
  if (t === "RUNNING") return "Laufen";
  if (t === "TRAIL_RUNNING") return "Trail";
  if (t === "CYCLING") return "Rad";
  if (t === "ROAD_BIKING") return "Rennrad";
  if (t === "MOUNTAIN_BIKING") return "Mountainbike";
  if (t === "WALKING") return "Gehen";
  if (t === "HIKING") return "Wandern";
  if (t === "SWIMMING") return "Schwimmen";
  if (t === "YOGA") return "Yoga";
  if (t === "STRENGTH_TRAINING") return "Kraft";
  if (t === "CORE") return "Core";
  if (t === "SKIING") return "Ski";
  if (t === "CROSS_COUNTRY_SKIING") return "Langlauf";
  if (t === "SNOWSHOE_TREKKING") return "Schneeschuh";
  if (t === "OTHER_INDOOR") return "Indoor";
  if (t === "OTHER_OUTDOOR") return "Outdoor";
  return type;
}

export const ACTIVITY_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "RUNNING", label: "Laufen" },
  { value: "TRAIL_RUNNING", label: "Trail-Lauf" },
  { value: "ROAD_BIKING", label: "Rennrad" },
  { value: "MOUNTAIN_BIKING", label: "Mountainbike" },
  { value: "CYCLING", label: "Rad (generisch)" },
  { value: "WALKING", label: "Gehen" },
  { value: "HIKING", label: "Wandern" },
  { value: "SWIMMING", label: "Schwimmen" },
  { value: "YOGA", label: "Yoga" },
  { value: "STRENGTH_TRAINING", label: "Krafttraining" },
  { value: "CORE", label: "Core" },
  { value: "SKIING", label: "Ski" },
  { value: "CROSS_COUNTRY_SKIING", label: "Langlauf" },
  { value: "SNOWSHOE_TREKKING", label: "Schneeschuh" },
  { value: "OTHER_OUTDOOR", label: "Outdoor (sonst.)" },
  { value: "OTHER_INDOOR", label: "Indoor (sonst.)" },
  { value: "OTHER", label: "Sonstiges" },
];

/**
 * Expand a goal's activityType to all equivalent activity types stored on
 * actual activities. "CYCLING" is a generic umbrella — Polar imports usually
 * tag rides as ROAD_BIKING / MOUNTAIN_BIKING, so a generic cycling goal
 * should include those.
 */
export function expandActivityType(type: string): string[] {
  const t = type.toUpperCase();
  if (t === "CYCLING") {
    return ["CYCLING", "ROAD_BIKING", "MOUNTAIN_BIKING"];
  }
  return [type];
}

export function activityTypeColor(type: string): string {
  const t = type.toUpperCase();
  if (t.includes("YOGA")) return "#00FFCC"; // neon aqua/mint
  if (t.includes("RUN") || t.includes("JOG")) return "#FF1493";
  if (t.includes("CYCL") || t.includes("BIK") || t.includes("RIDE")) return "#00D4FF";
  if (t.includes("HIK") || t.includes("TREK")) return "#39FF14";
  if (t.includes("WALK")) return "#FFD700";
  return "#B026FF";
}
