// Original brand-orange baked into Lottie JSONs: rgb(255,91,58) → normalized.
export const ORIGINAL_ORANGE: [number, number, number] = [1, 91 / 255, 58 / 255];

export function hexToRgbNormalized(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function nearlyEqual(a: number, b: number, tol = 0.02): boolean {
  return Math.abs(a - b) < tol;
}

function isColor(arr: number[], color: [number, number, number]): boolean {
  return (
    arr.length >= 3 &&
    nearlyEqual(arr[0], color[0]) &&
    nearlyEqual(arr[1], color[1]) &&
    nearlyEqual(arr[2], color[2])
  );
}

function isBlack(arr: number[]): boolean {
  return (
    arr.length >= 3 &&
    nearlyEqual(arr[0], 0) &&
    nearlyEqual(arr[1], 0) &&
    nearlyEqual(arr[2], 0)
  );
}

/**
 * Walk Lottie JSON, replacing the baked source color (default: brand orange)
 * with `tint`, and pure black strokes/fills with `blackReplace`. Other colors
 * stay intact. Pass `sourceColor` for Lotties that aren't keyed on orange
 * (e.g. footprint.json baked in cyan).
 */
export function tintLottie<T>(
  data: T,
  tint: [number, number, number],
  blackReplace: [number, number, number] = [1, 1, 1],
  sourceColor: [number, number, number] = ORIGINAL_ORANGE
): T {
  if (data == null) return data;
  if (Array.isArray(data)) {
    if (
      data.length === 4 &&
      data.every((v) => typeof v === "number" && v >= 0 && v <= 1)
    ) {
      const arr = data as number[];
      if (isColor(arr, sourceColor)) {
        return [tint[0], tint[1], tint[2], arr[3]] as unknown as T;
      }
      if (isBlack(arr)) {
        return [
          blackReplace[0],
          blackReplace[1],
          blackReplace[2],
          arr[3],
        ] as unknown as T;
      }
    }
    return data.map((item) =>
      tintLottie(item, tint, blackReplace, sourceColor),
    ) as unknown as T;
  }
  if (typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const k in data as Record<string, unknown>) {
      out[k] = tintLottie(
        (data as Record<string, unknown>)[k],
        tint,
        blackReplace,
        sourceColor,
      );
    }
    return out as T;
  }
  return data;
}
