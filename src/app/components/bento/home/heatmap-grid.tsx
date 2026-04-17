"use client";

import { useState } from "react";
import { spaceMono } from "../bento-fonts";

const NEON = "#FF6A00";

interface Day {
  key: string;
  dateIso: string;
  bucket: number;
  trimp: number;
  isToday: boolean;
}

export function HeatmapGrid({
  weeks,
  bucketColors,
  cell = 11,
  cellW,
  cellH,
  gap = 2,
}: {
  weeks: Day[][];
  bucketColors: string[];
  cell?: number;
  cellW?: number;
  cellH?: number;
  gap?: number;
}) {
  const w = cellW ?? cell;
  const h = cellH ?? cell;
  const bucketColor = (b: number) => bucketColors[b] ?? bucketColors[0];
  const [hover, setHover] = useState<{
    day: Day;
    col: number;
    row: number;
  } | null>(null);

  return (
    <div className="relative">
      <div
        className="flex"
        style={{ gap }}
        onMouseLeave={() => setHover(null)}
      >
        {weeks.map((week, col) => (
          <div key={col} className="flex flex-col" style={{ gap }}>
            {week.map((day, row) => (
              <div
                key={day.key}
                onMouseEnter={() => setHover({ day, col, row })}
                style={{
                  width: w,
                  height: h,
                  borderRadius: 2,
                  background: bucketColor(day.bucket),
                  boxShadow:
                    day.bucket >= 3
                      ? `0 0 4px ${bucketColor(day.bucket)}aa`
                      : undefined,
                  outline: day.isToday ? `1px solid ${NEON}` : undefined,
                  cursor: "pointer",
                  transition: "transform 0.08s ease",
                  transform:
                    hover && hover.col === col && hover.row === row
                      ? "scale(1.4)"
                      : "scale(1)",
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {hover && (
        <div
          className={`absolute pointer-events-none ${spaceMono.className} px-2 py-1 rounded-md border text-[10px] tabular-nums whitespace-nowrap z-10`}
          style={{
            left: hover.col * (w + gap) + w / 2,
            top: hover.row * (h + gap) + h + 8,
            transform: "translateX(-50%)",
            borderColor: `${NEON}77`,
            background: "rgba(10,10,10,0.94)",
            boxShadow: `0 0 10px ${NEON}55`,
            color: "#ffffff",
          }}
        >
          <div
            className="text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{ color: NEON }}
          >
            {new Date(hover.day.dateIso).toLocaleDateString("de-CH", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </div>
          <div className="font-bold">
            {hover.day.trimp > 0 ? (
              <>
                TRIMP{" "}
                <span style={{ color: NEON }}>
                  {Math.round(hover.day.trimp)}
                </span>
              </>
            ) : (
              <span className="text-[#a3a3a3]">keine Aktivität</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
