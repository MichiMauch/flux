"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";

type LottieType = "hiking" | "walk" | "bicycle";

function pickLottie(type: string): LottieType {
  const t = type.toUpperCase();
  if (t === "CYCLING" || t === "BIKING") return "bicycle";
  if (t === "WALKING" || t === "RUNNING") return "walk";
  return "hiking";
}

export function ActivityLottie({
  activityType,
  size = 120,
}: {
  activityType: string;
  size?: number;
}) {
  const file = pickLottie(activityType);
  const [data, setData] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/lottie/${file}.json`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!data) {
    return <div style={{ width: size, height: size }} />;
  }

  return (
    <div style={{ width: size, height: size }}>
      <Lottie animationData={data} loop autoplay />
    </div>
  );
}
