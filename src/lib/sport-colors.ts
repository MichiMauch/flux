export const NEON = "#FF6A00";
export const CYAN = "#00D4FF";
export const GREEN = "#39FF14";
export const YELLOW = "#FFD700";
export const RED = "#FF3B30";
export const MAGENTA = "#FF4DD2";
export const PURPLE = "#8A2BE2";
export const BLUE = "#00A8FF";

export const SPORT_COLORS: Record<string, string> = {
  RUNNING: NEON,
  CYCLING: CYAN,
  ROAD_BIKING: CYAN,
  MOUNTAIN_BIKING: BLUE,
  INDOOR_CYCLING: "#4DDCFF",
  SWIMMING: BLUE,
  WALKING: GREEN,
  HIKING: YELLOW,
  YOGA: MAGENTA,
  PILATES: "#FF8FD6",
  OTHER_INDOOR: MAGENTA,
  OTHER_OUTDOOR: PURPLE,
};

const FALLBACK_PALETTE = [NEON, CYAN, GREEN, YELLOW, PURPLE, MAGENTA, BLUE];

/**
 * Resolve a stable sport color. Uses the explicit SPORT_COLORS map when
 * known, otherwise falls back to a deterministic palette based on index.
 */
export function sportColor(type: string, fallbackIdx = 0): string {
  if (SPORT_COLORS[type]) return SPORT_COLORS[type];
  return FALLBACK_PALETTE[fallbackIdx % FALLBACK_PALETTE.length];
}
