"use client";

import { Heart, Mountain, Zap } from "lucide-react";
import type { Split } from "@/lib/splits";

const NEON = "var(--activity-color, #FF6A00)";
const NEON_ALPHA_1A =
  "color-mix(in srgb, var(--activity-color, #FF6A00) 10%, transparent)";
const NEON_ALPHA_22 =
  "color-mix(in srgb, var(--activity-color, #FF6A00) 13%, transparent)";
const NEON_ALPHA_55 =
  "color-mix(in srgb, var(--activity-color, #FF6A00) 33%, transparent)";

function formatPace(sec: number | null): string {
  if (sec == null || !isFinite(sec)) return "–";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSpeed(sec: number | null): string {
  if (sec == null || !isFinite(sec) || sec <= 0) return "–";
  const kmh = 3600 / sec;
  return kmh.toFixed(1);
}

interface Highlights {
  fastest: Split | null;
  hottest: Split | null;
  steepest: Split | null;
}

interface Props {
  splits: Split[];
  isRunning: boolean;
  selectedKm: number | null;
  onSelectKm: (km: number | null) => void;
  highlights: Highlights | null;
}

export function KilometerList({
  splits,
  isRunning,
  selectedKm,
  onSelectKm,
  highlights,
}: Props) {
  return (
    <>
      <div className="[font-family:var(--bento-mono)] px-3 py-2 bg-[#0a0a0a] border-b border-[#2a2a2a] text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3] sticky top-0 z-10">
        Runden
      </div>
      {highlights && (
        <div className="flex flex-col gap-1 p-2 border-b border-[#2a2a2a]">
          {highlights.fastest && (
            <HighlightChip
              onClick={() => onSelectKm(highlights.fastest!.index)}
              active={selectedKm === highlights.fastest.index}
              icon={<Zap className="h-3 w-3" />}
              label="Schnellster"
              kmIndex={highlights.fastest.index}
              value={
                isRunning
                  ? formatPace(highlights.fastest.paceSecPerKm)
                  : formatSpeed(highlights.fastest.paceSecPerKm)
              }
              unit={isRunning ? "min/km" : "km/h"}
            />
          )}
          {highlights.hottest?.hrAvg != null && (
            <HighlightChip
              onClick={() => onSelectKm(highlights.hottest!.index)}
              active={selectedKm === highlights.hottest.index}
              icon={<Heart className="h-3 w-3" />}
              label="Höchster Puls"
              kmIndex={highlights.hottest.index}
              value={`${highlights.hottest.hrAvg}`}
              unit="bpm"
            />
          )}
          {highlights.steepest && highlights.steepest.ascent > 0 && (
            <HighlightChip
              onClick={() => onSelectKm(highlights.steepest!.index)}
              active={selectedKm === highlights.steepest.index}
              icon={<Mountain className="h-3 w-3" />}
              label="Grösster Anstieg"
              kmIndex={highlights.steepest.index}
              value={`+${highlights.steepest.ascent}`}
              unit="m"
            />
          )}
        </div>
      )}
      <ul className="divide-y divide-[#2a2a2a]">
        {splits.map((s) => {
          const active = selectedKm === s.index;
          return (
            <li key={s.index}>
              <button
                type="button"
                onClick={() => onSelectKm(active ? null : s.index)}
                className="w-full text-left px-3 py-2 transition-colors hover:bg-[#151515]"
                style={
                  active
                    ? {
                        background: NEON_ALPHA_1A,
                        borderLeft: `3px solid ${NEON}`,
                      }
                    : undefined
                }
              >
                <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]">
                  km {s.index}
                </div>
                <div className="[font-family:var(--bento-mono)] mt-0.5 text-[11px] tabular-nums text-white flex items-baseline gap-1.5">
                  <span>
                    {isRunning
                      ? formatPace(s.paceSecPerKm)
                      : formatSpeed(s.paceSecPerKm)}
                    <span className="ml-0.5 text-[9px] text-[#a3a3a3]">
                      {isRunning ? "min/km" : "km/h"}
                    </span>
                  </span>
                  <span className="text-[#3a3a3a]">|</span>
                  <span>
                    <span>+{s.ascent}</span>
                    <span className="text-[#a3a3a3] mx-1">·</span>
                    <span className="text-[#a3a3a3]">−{s.descent}</span>
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function HighlightChip({
  onClick,
  active,
  icon,
  label,
  kmIndex,
  value,
  unit,
}: {
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  kmIndex: number;
  value: string;
  unit: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-md px-2.5 py-1.5 transition-colors hover:bg-[#151515]"
      style={
        active
          ? { background: NEON_ALPHA_22, border: `1px solid ${NEON_ALPHA_55}` }
          : { border: "1px solid #2a2a2a" }
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 [font-family:var(--bento-mono)] text-[9px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
          <span style={{ color: NEON }}>{icon}</span>
          {label}
        </div>
        <div className="[font-family:var(--bento-mono)] text-[9px] text-[#a3a3a3]">
          km {kmIndex}
        </div>
      </div>
      <div className="[font-family:var(--bento-mono)] mt-0.5 text-sm font-bold tabular-nums text-white">
        {value}
        <span className="ml-1 text-[9px] text-[#a3a3a3]">{unit}</span>
      </div>
    </button>
  );
}
