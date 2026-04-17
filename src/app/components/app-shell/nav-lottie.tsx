"use client";

import { useEffect, useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";

const cache = new Map<string, object>();

const SRC_CYAN: [number, number, number] = [51 / 255, 204 / 255, 204 / 255];
const SRC_RED: [number, number, number] = [1, 0, 0];

function nearlyEqual(a: number, b: number, tol = 0.02): boolean {
  return Math.abs(a - b) < tol;
}

function matches(arr: number[], src: [number, number, number]): boolean {
  return (
    nearlyEqual(arr[0], src[0]) &&
    nearlyEqual(arr[1], src[1]) &&
    nearlyEqual(arr[2], src[2])
  );
}

function hexToRgbNormalized(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function tintNav<T>(
  data: T,
  accent: [number, number, number],
  fg: [number, number, number],
): T {
  if (data == null) return data;
  if (Array.isArray(data)) {
    if (
      data.length === 4 &&
      data.every((v) => typeof v === "number" && v >= 0 && v <= 1)
    ) {
      const arr = data as number[];
      if (matches(arr, SRC_CYAN) || matches(arr, SRC_RED)) {
        return [accent[0], accent[1], accent[2], arr[3]] as unknown as T;
      }
      if (arr[0] < 0.02 && arr[1] < 0.02 && arr[2] < 0.02) {
        return [fg[0], fg[1], fg[2], arr[3]] as unknown as T;
      }
    }
    return data.map((item) => tintNav(item, accent, fg)) as unknown as T;
  }
  if (typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const k in data as Record<string, unknown>) {
      out[k] = tintNav((data as Record<string, unknown>)[k], accent, fg);
    }
    return out as T;
  }
  return data;
}

function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

const BRAND_LIGHT = "#FF5B3A";
const BRAND_DARK = "#E47E5E";

export function NavLottie({
  file,
  size = 36,
  accent,
  playing,
}: {
  file: string;
  size?: number;
  accent?: string;
  playing: boolean;
}) {
  const [data, setData] = useState<object | null>(null);
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const dark = useDarkMode();

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
      const fg: [number, number, number] = dark
        ? [245 / 255, 238 / 255, 227 / 255]
        : [28 / 255, 25 / 255, 23 / 255];
      const accentRgb = hexToRgbNormalized(
        accent ?? (dark ? BRAND_DARK : BRAND_LIGHT),
      );
      setData(tintNav(raw, accentRgb, fg));
    };
    load().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [file, accent, dark]);

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
        autoplay={false}
      />
    </span>
  );
}
