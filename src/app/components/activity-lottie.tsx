"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";

type LottieType = "hiking" | "walk" | "bicycle" | "running" | "wellbeing";

function pickLottie(type: string, name?: string | null): LottieType {
  const t = `${type} ${name ?? ""}`.toUpperCase();
  if (t.includes("CYCL") || t.includes("BIK") || t.includes("RIDE")) return "bicycle";
  if (t.includes("HIK") || t.includes("TREK") || t.includes("MOUNTAIN")) return "hiking";
  if (t.includes("RUN") || t.includes("JOG")) return "running";
  if (t.includes("WALK")) return "walk";
  return "wellbeing";
}

// Original brand-orange baked into Lottie JSONs: rgb(255,91,58) → normalized.
const ORIGINAL_ORANGE: [number, number, number] = [1, 91 / 255, 58 / 255];

function hexToRgbNormalized(hex: string): [number, number, number] {
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

function isOriginalOrange(arr: number[]): boolean {
  return (
    arr.length >= 3 &&
    nearlyEqual(arr[0], ORIGINAL_ORANGE[0]) &&
    nearlyEqual(arr[1], ORIGINAL_ORANGE[1]) &&
    nearlyEqual(arr[2], ORIGINAL_ORANGE[2])
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
 * Walk Lottie JSON, replacing baked original-orange with `tint`, and
 * pure black strokes/fills with white (for dark backgrounds).
 * Other colors (teal, red accents) are kept intact.
 */
function tintLottie<T>(data: T, tint: [number, number, number]): T {
  if (data == null) return data;
  if (Array.isArray(data)) {
    // Color array: [r, g, b, a] with 4 numbers in [0,1]
    if (
      data.length === 4 &&
      data.every((v) => typeof v === "number" && v >= 0 && v <= 1)
    ) {
      const arr = data as number[];
      if (isOriginalOrange(arr)) {
        return [tint[0], tint[1], tint[2], arr[3]] as unknown as T;
      }
      if (isBlack(arr)) {
        return [1, 1, 1, arr[3]] as unknown as T;
      }
    }
    return data.map((item) => tintLottie(item, tint)) as unknown as T;
  }
  if (typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const k in data as Record<string, unknown>) {
      out[k] = tintLottie((data as Record<string, unknown>)[k], tint);
    }
    return out as T;
  }
  return data;
}

export function ActivityLottie({
  activityType,
  activityName,
  size = 120,
  tint = "#FF6A00",
}: {
  activityType: string;
  activityName?: string | null;
  size?: number;
  tint?: string;
}) {
  const file = pickLottie(activityType, activityName);
  const [data, setData] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/lottie/${file}.json`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const rgb = hexToRgbNormalized(tint);
        setData(tintLottie(json, rgb));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [file, tint]);

  if (!data) {
    return <div style={{ width: size, height: size }} />;
  }

  return (
    <div style={{ width: size, height: size }}>
      <Lottie animationData={data} loop autoplay />
    </div>
  );
}
