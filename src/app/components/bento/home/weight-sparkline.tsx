"use client";

import { useState } from "react";
import { spaceMono } from "../bento-fonts";

const NEON = "#FF6A00";

interface Point {
  date: string | Date;
  weight: number;
}

export function WeightSparkline({ points }: { points: Point[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length < 2) return null;

  const minW = Math.min(...points.map((p) => p.weight));
  const maxW = Math.max(...points.map((p) => p.weight));
  const dy = Math.max(0.1, maxW - minW);
  const W = 200;
  const H = 50;
  const pad = 4;
  const stepX = (W - pad * 2) / Math.max(1, points.length - 1);
  const r = (n: number) => Math.round(n * 100) / 100;
  const xAt = (i: number) => pad + i * stepX;
  const yAt = (v: number) => H - pad - ((v - minW) / dy) * (H - pad * 2);

  let line = "";
  let area = `M${r(pad)},${r(H - pad)} `;
  points.forEach((p, i) => {
    const x = xAt(i);
    const y = yAt(p.weight);
    line += `${i === 0 ? "M" : "L"}${r(x)},${r(y)} `;
    area += `L${r(x)},${r(y)} `;
  });
  area += `L${r(W - pad)},${r(H - pad)} Z`;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const xVb = (xPx / rect.width) * W;
    const idx = Math.round((xVb - pad) / stepX);
    if (idx >= 0 && idx < points.length) setHoverIdx(idx);
    else setHoverIdx(null);
  }

  const hover = hoverIdx != null ? points[hoverIdx] : null;

  return (
    <div className="relative flex-1 min-h-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full cursor-crosshair"
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="weight-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={NEON} stopOpacity="0.4" />
            <stop offset="100%" stopColor={NEON} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#weight-grad)" />
        <path
          d={line}
          fill="none"
          stroke={NEON}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 3px ${NEON}aa)` }}
        />
        {hoverIdx != null && (
          <>
            <line
              x1={xAt(hoverIdx)}
              x2={xAt(hoverIdx)}
              y1={2}
              y2={H - 2}
              stroke="#ffffff"
              strokeWidth={1}
              strokeOpacity={0.35}
              strokeDasharray="2 2"
            />
            <circle
              cx={xAt(hoverIdx)}
              cy={yAt(points[hoverIdx].weight)}
              r={3}
              fill={NEON}
              stroke="#ffffff"
              strokeWidth={1}
              style={{ filter: `drop-shadow(0 0 4px ${NEON})` }}
            />
          </>
        )}
      </svg>
      {hover && hoverIdx != null && (
        <div
          className={`absolute -top-1 -translate-y-full -translate-x-1/2 pointer-events-none ${spaceMono.className} px-2 py-1 rounded-md border text-[10px] tabular-nums whitespace-nowrap`}
          style={{
            left: `${((hoverIdx + 0.5) / points.length) * 100}%`,
            borderColor: `${NEON}77`,
            background: "rgba(10,10,10,0.92)",
            boxShadow: `0 0 10px ${NEON}55`,
            color: "#ffffff",
          }}
        >
          <span className="font-bold">{hover.weight.toFixed(1)} kg</span>
          <span className="text-[#9ca3af] ml-1.5">
            {new Date(hover.date).toLocaleDateString("de-CH", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        </div>
      )}
    </div>
  );
}
