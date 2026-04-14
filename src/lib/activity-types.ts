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
  if (t === "RUNNING") return "#FF5B3A";
  if (t === "CYCLING") return "#3B82F6";
  if (t === "WALKING") return "#78716C";
  if (t === "HIKING") return "#16A34A";
  return "#78716C";
}
