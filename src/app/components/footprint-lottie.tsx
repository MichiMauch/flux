"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import { hexToRgbNormalized, tintLottie } from "./lottie-utils";

const FOOTPRINT_SOURCE: [number, number, number] = [51 / 255, 204 / 255, 204 / 255];

let cached: object | null = null;
let inflight: Promise<object> | null = null;

function loadFootprint(): Promise<object> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = fetch("/lottie/footprint.json")
    .then((r) => r.json())
    .then((json) => {
      cached = json;
      inflight = null;
      return json;
    });
  return inflight;
}

export function FootprintLottie({
  size = 18,
  tint,
  title,
}: {
  size?: number;
  tint: string;
  title?: string;
}) {
  const [data, setData] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadFootprint().then((json) => {
      if (cancelled) return;
      const rgb = hexToRgbNormalized(tint);
      setData(tintLottie(json, rgb, [1, 1, 1], FOOTPRINT_SOURCE));
    });
    return () => {
      cancelled = true;
    };
  }, [tint]);

  if (!data) return <div style={{ width: size, height: size }} />;

  return (
    <div
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 0 4px ${tint}80)`,
      }}
      title={title}
    >
      <Lottie animationData={data} loop autoplay />
    </div>
  );
}
