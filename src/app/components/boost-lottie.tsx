"use client";

import { useEffect, useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";

const cache = new Map<string, object>();

function nearlyEqual(a: number, b: number, tol = 0.05): boolean {
  return Math.abs(a - b) < tol;
}

function hexToRgbNormalized(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return [r, g, b];
}

// Tint *every* visible color in the Lottie data to the accent color.
// Mono-color icon — works on any background (incl. dark themes where
// black would be invisible). Only fully-transparent values are kept
// as-is. Strokes/fills are mapped to the accent so the whole shape
// glows in one neon hue.
function tintAll<T>(data: T, accent: [number, number, number]): T {
  if (data == null) return data;
  if (Array.isArray(data)) {
    if (
      data.length === 4 &&
      data.every((v) => typeof v === "number" && v >= 0 && v <= 1)
    ) {
      const arr = data as number[];
      const isTransparent = nearlyEqual(arr[3], 0);
      if (!isTransparent) {
        return [accent[0], accent[1], accent[2], arr[3]] as unknown as T;
      }
    }
    return data.map((item) => tintAll(item, accent)) as unknown as T;
  }
  if (typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const k in data as Record<string, unknown>) {
      out[k] = tintAll((data as Record<string, unknown>)[k], accent);
    }
    return out as T;
  }
  return data;
}

interface Props {
  file: string;
  size?: number;
  color: string;
  playing: boolean;
}

export function BoostLottie({ file, size = 22, color, playing }: Props) {
  const [data, setData] = useState<object | null>(null);
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let raw = cache.get(file);
      if (!raw) {
        const res = await fetch(`/lottie/${file}.json`);
        raw = (await res.json()) as object;
        cache.set(file, raw);
      }
      if (cancelled) return;
      const accent = hexToRgbNormalized(color);
      setData(tintAll(raw, accent));
    };
    load().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [file, color]);

  useEffect(() => {
    const ref = lottieRef.current;
    if (!ref || !data) return;
    if (playing) {
      ref.goToAndPlay(0, true);
    } else {
      ref.goToAndStop(0, true);
    }
  }, [playing, data]);

  if (!data) {
    return (
      <span
        aria-hidden
        className="shrink-0"
        style={{ width: size, height: size, display: "inline-block" }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="shrink-0"
      style={{ width: size, height: size, display: "inline-block" }}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={data}
        loop
        autoplay={playing}
      />
    </span>
  );
}
