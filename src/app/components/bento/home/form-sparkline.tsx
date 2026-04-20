"use client";

import type { TrainingLoadPoint } from "@/lib/training-load";

const CTL_COLOR = "#60A5FA";
const ATL_COLOR = "#F472B6";

interface Props {
  points: TrainingLoadPoint[];
  zoneColor: string;
}

export function FormSparkline({ points, zoneColor }: Props) {
  if (points.length < 2) return null;

  const W = 360;
  const H = 90;
  const padL = 2;
  const padR = 2;
  const padT = 4;
  const padB = 4;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const values = points.flatMap((p) => [p.ctl, p.atl]);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 10);
  const range = Math.max(1, max - min);

  const xAt = (i: number) => padL + (i / (points.length - 1)) * plotW;
  const yAt = (v: number) => padT + plotH - ((v - min) / range) * plotH;
  const r = (n: number) => Math.round(n * 100) / 100;

  let ctlPath = "";
  let atlPath = "";
  let areaPath = `M${r(xAt(0))},${r(yAt(points[0].ctl))} `;
  points.forEach((p, i) => {
    const x = xAt(i);
    ctlPath += `${i === 0 ? "M" : "L"}${r(x)},${r(yAt(p.ctl))} `;
    atlPath += `${i === 0 ? "M" : "L"}${r(x)},${r(yAt(p.atl))} `;
    areaPath += `L${r(x)},${r(yAt(p.ctl))} `;
  });
  // Close area back along ATL
  for (let i = points.length - 1; i >= 0; i--) {
    areaPath += `L${r(xAt(i))},${r(yAt(points[i].atl))} `;
  }
  areaPath += "Z";

  return (
    <div className="relative flex-1 min-h-0">
      <div
        className="absolute inset-0 overflow-hidden rounded-md border border-[#2a2a2a]"
        style={{
          background:
            "radial-gradient(ellipse at center, #0a0a0a 0%, #000 80%)",
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="relative w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="form-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={zoneColor} stopOpacity="0.35" />
              <stop offset="100%" stopColor={zoneColor} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* TSB area = gap between CTL and ATL, shaded in zone color */}
          <path d={areaPath} fill="url(#form-area)" />

          {/* ATL (fatigue) — dashed */}
          <path
            d={atlPath}
            fill="none"
            stroke={ATL_COLOR}
            strokeWidth={1.4}
            strokeDasharray="3 2"
            strokeLinecap="round"
          />

          {/* CTL (fitness) — solid, glowing */}
          <path
            d={ctlPath}
            fill="none"
            stroke={CTL_COLOR}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: `drop-shadow(0 0 2px ${CTL_COLOR}aa)`,
            }}
          />
        </svg>
      </div>
    </div>
  );
}
