"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";

type LottieType = "hiking" | "walk" | "bicycle";

function pickLottie(type: string, name?: string | null): LottieType {
  const t = `${type} ${name ?? ""}`.toUpperCase();
  if (t.includes("CYCL") || t.includes("BIK") || t.includes("RIDE")) return "bicycle";
  if (t.includes("HIK") || t.includes("TREK") || t.includes("MOUNTAIN")) return "hiking";
  if (t.includes("WALK") || t.includes("RUN") || t.includes("JOG")) return "walk";
  return "hiking";
}

export function ActivityLottie({
  activityType,
  activityName,
  size = 120,
}: {
  activityType: string;
  activityName?: string | null;
  size?: number;
}) {
  const file = pickLottie(activityType, activityName);
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
