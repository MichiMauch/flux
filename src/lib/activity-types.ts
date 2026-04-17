export function activityTypeLabel(type: string): string {
  const t = type.toUpperCase();
  if (t === "RUNNING") return "Laufen";
  if (t === "CYCLING") return "Rad";
  if (t === "WALKING") return "Gehen";
  if (t === "HIKING") return "Wandern";
  return type;
}

export function activityTypeColor(type: string): string {
  const t = type.toUpperCase();
  if (t.includes("RUN") || t.includes("JOG")) return "#FF1493";
  if (t.includes("CYCL") || t.includes("BIK") || t.includes("RIDE")) return "#00D4FF";
  if (t.includes("HIK") || t.includes("TREK")) return "#39FF14";
  if (t.includes("WALK")) return "#FFD700";
  return "#B026FF";
}
