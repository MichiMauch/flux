"use client";

import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import { hexToRgbNormalized, tintLottie } from "./lottie-utils";

type LottieType =
  | "hiking"
  | "walk"
  | "bicycle"
  | "running"
  | "outdoor"
  | "yoga-pose"
  | "indoor"
  | "balance-board";

function pickLottie(type: string, name?: string | null): LottieType {
  const t = type.toUpperCase();
  if (t.includes("BALANCE")) return "balance-board";
  if (t.includes("YOGA") || t.includes("PILATES")) return "yoga-pose";
  if (t.includes("CYCL") || t.includes("BIK") || t.includes("RIDE")) return "bicycle";
  if (t.includes("HIK") || t.includes("TREK") || t.includes("MOUNTAIN")) return "hiking";
  if (t.includes("RUN") || t.includes("JOG")) return "running";
  if (t.includes("WALK")) return "walk";
  if (t.includes("INDOOR") || t.includes("STRENGTH") || t.includes("CORE")) return "indoor";
  // Nur bei generischen Typen den Namen als Fallback heranziehen, damit
  // z. B. "Runde um Muhen" (WALKING) nicht via "RUN"-Substring zum
  // running-Icon mutiert.
  if (t === "OTHER" || t === "OTHER_OUTDOOR" || t === "OTHER_INDOOR") {
    const n = (name ?? "").toUpperCase();
    if (n.includes("BALANCE")) return "balance-board";
    if (n.includes("YOGA") || n.includes("PILATES")) return "yoga-pose";
    if (n.includes("CYCL") || n.includes("BIK") || n.includes("RIDE")) return "bicycle";
    if (n.includes("HIK") || n.includes("TREK") || n.includes("MOUNTAIN")) return "hiking";
    if (n.includes("RUN") || n.includes("JOG")) return "running";
    if (n.includes("WALK")) return "walk";
    if (t === "OTHER_INDOOR" || n.includes("INDOOR") || n.includes("STRENGTH") || n.includes("CORE")) return "indoor";
  }
  return "outdoor";
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
