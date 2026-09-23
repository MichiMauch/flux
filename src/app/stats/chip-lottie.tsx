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
  // Geladene Datei samt Namen merken: wechselt `file`, gilt der alte Stand
  // automatisch nicht mehr, ohne dass der Effect synchron zurücksetzen muss.
  const [loaded, setLoaded] = useState<{ file: string; json: object } | null>(
    null
  );
  const raw =
    cache.get(file) ?? (loaded?.file === file ? loaded.json : null);

  useEffect(() => {
    if (cache.has(file)) return;
    let cancelled = false;
    fetch(`/lottie/${file}.json`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        cache.set(file, json);
        setLoaded({ file, json });
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
