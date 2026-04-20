"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bike,
  Dumbbell,
  Flower2,
  Footprints,
  Moon,
  Mountain,
  Snowflake,
  Waves,
  Zap,
} from "lucide-react";
import { rajdhani, spaceMono } from "../bento/bento-fonts";
import type { CoachSuggestion } from "@/lib/coach-prompt";

const SPORT_META: Record<
  CoachSuggestion["sport"],
  { icon: LucideIcon; label: string; accent: string }
> = {
  RUNNING: { icon: Footprints, label: "Laufen", accent: "#FF1493" },
  CYCLING: { icon: Bike, label: "Radfahren", accent: "#00D4FF" },
  HIKING: { icon: Mountain, label: "Wandern", accent: "#8B7355" },
  WALKING: { icon: Footprints, label: "Spaziergang", accent: "#A3A3A3" },
  SWIMMING: { icon: Waves, label: "Schwimmen", accent: "#38BDF8" },
  STRENGTH_TRAINING: { icon: Dumbbell, label: "Kraft", accent: "#F97316" },
  YOGA: { icon: Flower2, label: "Yoga", accent: "#A855F7" },
  CROSS_COUNTRY_SKIING: {
    icon: Snowflake,
    label: "Langlauf",
    accent: "#7DD3FC",
  },
  REST: { icon: Moon, label: "Ruhe", accent: "#737373" },
  OTHER: { icon: Zap, label: "Anderes", accent: "#FF6A00" },
};

const INTENSITY_META: Record<
  CoachSuggestion["intensity"],
  { label: string; color: string }
> = {
  REST: { label: "Ruhe", color: "#737373" },
  Z1: { label: "Z1", color: "#A3A3A3" },
  Z2: { label: "Z2", color: "#60A5FA" },
  "Z2-Z3": { label: "Z2–Z3", color: "#38BDF8" },
  Z3: { label: "Z3", color: "#22C55E" },
  "Z3-Z4": { label: "Z3–Z4", color: "#EAB308" },
  Z4: { label: "Z4", color: "#F97316" },
  Z5: { label: "Z5", color: "#EF4444" },
  MIXED: { label: "Mixed", color: "#FF6A00" },
};

function formatDayLabel(offset: number): string {
  if (offset === 0) return "Heute";
  if (offset === 1) return "Morgen";
  if (offset === 2) return "Übermorgen";
  return `In ${offset} Tagen`;
}

export function CoachSuggestionCard({
  suggestion,
}: {
  suggestion: CoachSuggestion;
}) {
  const sport = SPORT_META[suggestion.sport];
  const intensity = INTENSITY_META[suggestion.intensity];
  const SportIcon = sport.icon;
  const isRest =
    suggestion.sport === "REST" || suggestion.intensity === "REST";

  return (
    <div
      className="rounded-lg border border-[#2a2a2a] bg-black/40 p-4 flex flex-col gap-3"
      style={{ borderColor: `${sport.accent}33` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          {formatDayLabel(suggestion.dayOffset)}
        </span>
        <span
          className={`${spaceMono.className} rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] tabular-nums`}
          style={{
            color: intensity.color,
            background: `${intensity.color}1a`,
            border: `1px solid ${intensity.color}44`,
          }}
        >
          {intensity.label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
          style={{
            background: `${sport.accent}14`,
            border: `1px solid ${sport.accent}44`,
            color: sport.accent,
          }}
        >
          <SportIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`${rajdhani.className} text-xl font-bold leading-tight text-white truncate`}
          >
            {suggestion.title}
          </p>
          <p
            className={`${spaceMono.className} text-[10px] uppercase tracking-[0.12em] text-[#a3a3a3]`}
          >
            {sport.label}
            {!isRest && suggestion.durationMin > 0 && (
              <>
                <span className="mx-1.5 text-[#3a3a3a]">·</span>
                <span className="tabular-nums text-white">
                  {suggestion.durationMin} min
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-[#d4d4d4]">
        {suggestion.why}
      </p>
    </div>
  );
}
