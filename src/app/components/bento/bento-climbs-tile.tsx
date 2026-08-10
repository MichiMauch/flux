"use client";

import { useState } from "react";
import { ChevronDown, MoveRight, TrendingDown, TrendingUp } from "lucide-react";
import type { ClimbSegment, ClimbSummary, ClimbTotals } from "@/lib/climbs";
import { Tile, TileLabel } from "@/app/activity/[id]/tiles";
import { SevenSegDisplay } from "@/app/components/bento/seven-seg";
import { CLIMB_DOWN, CLIMB_FLAT, CLIMB_UP } from "./climb-colors";
import { useHover } from "./hover-context";

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "–";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatPace(sec: number | null, isRunning: boolean): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "–";
  if (!isRunning) return `${(3600 / sec).toFixed(1)} km/h`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")} min/km`;
}

export function segmentKey(seg: ClimbSegment): string {
  return `climb:${seg.type}:${seg.index}`;
}

export function BentoClimbsTile({
  climbs,
  isRunning = false,
  className,
}: {
  climbs: ClimbSummary | null;
  isRunning?: boolean;
  className?: string;
}) {
  const { selection, toggleSelection } = useHover();
  const [open, setOpen] = useState(false);

  if (!climbs) return null;
  const { up, down, flat, segments } = climbs;
  if (up.count === 0 && down.count === 0) return null;

  const listed = segments.filter((s) => s.type !== "flat");
  // On a route that is climbing or descending throughout, a flat column would
  // just read "0.00 km · – · Ø –".
  const showFlat = flat.distanceKm >= 0.01;

  return (
    <Tile className={className}>
      <div className="flex items-center justify-between mb-3">
        <TileLabel>Steigungen / Gefälle</TileLabel>
        <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] tabular-nums">
          <span style={{ color: CLIMB_UP }}>{up.count}</span>
          <span className="text-[#3a3a3a] mx-1">/</span>
          <span style={{ color: CLIMB_DOWN }}>{down.count}</span>
        </div>
      </div>

      <div className="flex items-stretch gap-3">
        <Entry
          icon={<TrendingUp />}
          label="Steigungen"
          color={CLIMB_UP}
          totals={up}
          isRunning={isRunning}
        />
        <div className="w-px self-stretch bg-[#1a1a1a]" />
        <Entry
          icon={<TrendingDown />}
          label="Gefälle"
          color={CLIMB_DOWN}
          totals={down}
          isRunning={isRunning}
        />
        {showFlat && (
          <>
            <div className="w-px self-stretch bg-[#1a1a1a]" />
            <Entry
              icon={<MoveRight />}
              label="Flach"
              color={CLIMB_FLAT}
              totals={flat}
              isRunning={isRunning}
            />
          </>
        )}
      </div>

      {listed.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="climb-segment-list"
            className="cursor-pointer mt-3 w-full flex items-center justify-between border-t border-[#1a1a1a] pt-2.5 [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white transition-colors"
          >
            <span>{listed.length} Segmente</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
          {open && (
            <ul
              id="climb-segment-list"
              className="mt-1 max-h-[260px] overflow-y-auto divide-y divide-[#1a1a1a] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {listed.map((seg) => {
                const key = segmentKey(seg);
                const active = selection?.key === key;
                const color = seg.type === "up" ? CLIMB_UP : CLIMB_DOWN;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() =>
                        toggleSelection({
                          key,
                          range: [seg.startIdx, seg.endIdx],
                        })
                      }
                      className="cursor-pointer w-full text-left px-1.5 py-2 transition-colors hover:bg-[#151515]"
                      style={
                        active
                          ? {
                              background: `color-mix(in srgb, ${color} 12%, transparent)`,
                              borderLeft: `3px solid ${color}`,
                            }
                          : { borderLeft: "3px solid transparent" }
                      }
                    >
                      <div className="flex items-center justify-between gap-2 [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.12em]">
                        <span
                          className="flex items-center gap-1.5"
                          style={{ color }}
                        >
                          <span className="[&>svg]:h-3 [&>svg]:w-3">
                            {seg.type === "up" ? (
                              <TrendingUp />
                            ) : (
                              <TrendingDown />
                            )}
                          </span>
                          {seg.type === "up" ? "Anstieg" : "Abstieg"} {seg.index}
                        </span>
                        <span className="text-[#a3a3a3] tabular-nums">
                          {seg.gradePct > 0 ? "+" : ""}
                          {seg.gradePct.toFixed(1)} %
                        </span>
                      </div>
                      <div className="[font-family:var(--bento-mono)] mt-0.5 text-[11px] tabular-nums text-white flex items-baseline gap-1.5">
                        <span>{seg.distanceKm.toFixed(2)} km</span>
                        <span className="text-[#3a3a3a]">|</span>
                        <span>
                          {seg.elevationChange > 0 ? "+" : "−"}
                          {Math.abs(Math.round(seg.elevationChange))} m
                        </span>
                        <span className="text-[#3a3a3a]">|</span>
                        <span className="text-[#a3a3a3]">
                          {formatDuration(seg.durationSec)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Tile>
  );
}

function Entry({
  icon,
  label,
  color,
  totals,
  isRunning,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  totals: ClimbTotals;
  isRunning: boolean;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3]">
        <span className="[&>svg]:h-3 [&>svg]:w-3" style={{ color }}>
          {icon}
        </span>
        {label}
      </div>
      <div
        className="mt-2 flex items-end gap-1 leading-none"
        style={{ fontSize: "22px" }}
      >
        <SevenSegDisplay value={totals.distanceKm.toFixed(2)} />
        <span
          className="[font-family:var(--bento-mono)] font-bold text-[0.42em] lowercase pb-[0.15em]"
          style={{ color }}
        >
          km
        </span>
      </div>
      <div className="[font-family:var(--bento-mono)] mt-2 text-[10px] tabular-nums text-[#a3a3a3] leading-relaxed">
        <div>{formatDuration(totals.durationSec)}</div>
        <div>Ø {formatPace(totals.paceSecPerKm, isRunning)}</div>
        {totals.elevation > 0 && (
          <div style={{ color }}>{totals.elevation} m</div>
        )}
      </div>
    </div>
  );
}
