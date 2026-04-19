// ----- Distance ---------------------------------------------------------

/** Returns the distance as a bare number string in km with the given decimals. */
export function formatDistanceKm(meters: number, decimals = 2): string {
  return (meters / 1000).toFixed(decimals);
}

/**
 * Returns the distance as a bare number string — km with decimals when
 * ≥ 1 km, otherwise rounded meters. No unit suffix (caller adds "km"/"m").
 */
export function formatDistanceValue(meters: number, kmDecimals = 2): string {
  if (meters >= 1000) return (meters / 1000).toFixed(kmDecimals);
  return String(Math.round(meters));
}

/** Full distance string with auto unit. "1.2 km" or "500 m". */
export function formatDistanceAuto(meters: number, kmDecimals = 1): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(kmDecimals)} km`;
  return `${Math.round(meters)} m`;
}

// ----- Duration ---------------------------------------------------------

/** "1:30" / "30" — colon form, no seconds, minutes unpadded when no hour. */
export function formatDurationShort(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}`;
  return `${m}`;
}

/** "1:23:45" / "23:45" — with seconds, minutes unpadded when no hour. */
export function formatDurationHMS(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** "01:30:45" / "01:30" — with seconds, minutes always zero-padded. */
export function formatDurationMMSS(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** "1h 30min" / "30min" — compact, no padding. */
export function formatDurationWords(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

/** "1h 30min" / "30min" — compact, minutes zero-padded. */
export function formatDurationWordsPadded(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`;
  return `${m}min`;
}

/** "1 h 30 min" / "30 min" — spaced, minutes zero-padded when hours. */
export function formatDurationWordsSpaced(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} h ${m.toString().padStart(2, "0")} min`;
  return `${m} min`;
}

/** "1h 30m" — always shows hours, minutes zero-padded. */
export function formatDurationHmSuffix(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

/** Integer hours only, as a string. */
export function formatDurationHours(sec: number): string {
  return String(Math.floor(sec / 3600));
}

/**
 * Split duration into `{ value, unit }` for segmented displays.
 * Hours: `{ value: "1:30", unit: "h" }`. Minutes: `{ value: "30", unit: "m" }`.
 */
export function formatDurationHmSplit(sec: number): {
  value: string;
  unit: string;
} {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0)
    return { value: `${h}:${m.toString().padStart(2, "0")}`, unit: "h" };
  return { value: String(m), unit: "m" };
}

// ----- Date / time ------------------------------------------------------

export function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
