"use client";

import Link from "next/link";
import { HelpCircle, X } from "lucide-react";
import { spaceMono } from "../components/bento/bento-fonts";
import { PRESET_RANGES, sportLabel, type TimeRange } from "./filters";
import { ChipLottie } from "./chip-lottie";

const NEON = "#FF6A00";
const DIM = "#a3a3a3";

interface StatsFilterBarProps {
  range: TimeRange;
  sport: string | null;
  availableSports: string[];
  availableYears: number[];
}

function buildHref(range: TimeRange, sport: string | null): string {
  const p = new URLSearchParams();
  p.set("range", range);
  if (sport) p.set("sport", sport);
  return `/stats?${p.toString()}`;
}

/** Maps a sport type to its Lottie file. Returns null for unmapped types. */
function sportLottie(type: string): string | null {
  const t = type.toUpperCase();
  if (t === "RUNNING") return "running";
  if (
    t === "CYCLING" ||
    t === "ROAD_BIKING" ||
    t === "MOUNTAIN_BIKING" ||
    t === "INDOOR_CYCLING"
  )
    return "bicycle";
  if (t === "WALKING") return "walk";
  if (t === "HIKING") return "hiking";
  if (t === "YOGA" || t === "PILATES") return "yoga-pose";
  return null;
}

export function StatsFilterBar({
  range,
  sport,
  availableSports,
  availableYears,
}: StatsFilterBarProps) {
  const isReset = range === "all" && sport === null;
  return (
    <div className={`${spaceMono.className} flex flex-col gap-2 text-[11px]`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#a3a3a3]">
          Zeitraum
        </span>
        <div className="flex flex-wrap gap-1">
          {PRESET_RANGES.map((r) => (
            <Chip
              key={r.value}
              href={buildHref(r.value, sport)}
              active={r.value === range}
              label={r.label}
            />
          ))}
        </div>
        {availableYears.length > 0 && (
          <>
            <span className="ml-2 text-[9px] font-bold uppercase tracking-[0.22em] text-[#a3a3a3]">
              Jahr
            </span>
            <div className="flex flex-wrap gap-1">
              {availableYears.map((y) => {
                const value: TimeRange = `year:${y}`;
                return (
                  <Chip
                    key={y}
                    href={buildHref(value, sport)}
                    active={range === value}
                    label={String(y)}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#a3a3a3]">
          Sportart
        </span>
        <div className="flex flex-wrap gap-1">
          <Chip
            href={buildHref(range, null)}
            active={sport === null}
            label="Alle"
            icon={
              <ChipLottie
                file="all-skins"
                tint={sport === null ? NEON : DIM}
              />
            }
          />
          {availableSports.map((s) => {
            const active = sport === s;
            const lottie = sportLottie(s);
            return (
              <Chip
                key={s}
                href={buildHref(range, s)}
                active={active}
                label={sportLabel(s)}
                icon={
                  lottie ? (
                    <ChipLottie file={lottie} tint={active ? NEON : DIM} />
                  ) : (
                    <HelpCircle
                      className="h-[14px] w-[14px]"
                      style={{ color: active ? NEON : DIM }}
                    />
                  )
                }
              />
            );
          })}
        </div>
        {!isReset && (
          <Link
            href="/stats?range=all"
            prefetch={false}
            aria-label="Filter zurücksetzen"
            title="Filter zurücksetzen"
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] transition hover:border-[#FF6A0077] hover:text-white"
          >
            <X className="h-[14px] w-[14px]" />
            <span>Reset</span>
          </Link>
        )}
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  label,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition"
      style={
        active
          ? {
              borderColor: NEON,
              color: NEON,
              background: "rgba(255,106,0,0.08)",
              boxShadow: `0 0 8px ${NEON}66`,
              textShadow: `0 0 4px ${NEON}aa`,
            }
          : {
              borderColor: "#2a2a2a",
              color: DIM,
              background: "#0f0f0f",
            }
      }
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
