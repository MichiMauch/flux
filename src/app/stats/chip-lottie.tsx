"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import { hexToRgbNormalized, tintLottie } from "../components/lottie-utils";

interface ChipLottieProps {
  file: string;
  tint: string;
  size?: number;
}

const cache = new Map<string, object>();

export function ChipLottie({ file, tint, size = 18 }: ChipLottieProps) {
  const [raw, setRaw] = useState<object | null>(() => cache.get(file) ?? null);

  useEffect(() => {
    if (cache.has(file)) {
      setRaw(cache.get(file)!);
      return;
    }
    let cancelled = false;
    fetch(`/lottie/${file}.json`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        cache.set(file, json);
        setRaw(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!raw) return <span style={{ width: size, height: size, display: "inline-block" }} />;

  const rgb = hexToRgbNormalized(tint);
  const data = tintLottie(raw, rgb, rgb);

  return (
    <span
      style={{ width: size, height: size, display: "inline-block", flexShrink: 0 }}
    >
      <Lottie animationData={data} loop autoplay />
    </span>
  );
}
