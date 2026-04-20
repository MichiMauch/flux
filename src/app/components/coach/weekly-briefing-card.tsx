import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  Dumbbell,
  Flower2,
  Footprints,
  Info,
  Moon,
  Mountain,
  Snowflake,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { rajdhani, spaceMono } from "../bento/bento-fonts";
import type {
  WeeklyBriefing,
  WeeklyBriefingSuggestion,
  WeeklyBriefingWarning,
} from "@/lib/weekly-briefing-prompt";
import type { WeeklyRecap } from "@/lib/weekly-recap";

const NEON = "#FF6A00";

const SPORT_META: Record<
  WeeklyBriefingSuggestion["sport"],
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

const INTENSITY_COLOR: Record<WeeklyBriefingSuggestion["intensity"], string> = {
  REST: "#737373",
  Z1: "#A3A3A3",
  Z2: "#60A5FA",
  "Z2-Z3": "#38BDF8",
  Z3: "#22C55E",
  "Z3-Z4": "#EAB308",
  Z4: "#F97316",
  Z5: "#EF4444",
  MIXED: "#FF6A00",
};

const WEEKDAY_SHORT: Record<WeeklyBriefingSuggestion["weekday"], string> = {
  Montag: "Mo",
  Dienstag: "Di",
  Mittwoch: "Mi",
  Donnerstag: "Do",
  Freitag: "Fr",
  Samstag: "Sa",
  Sonntag: "So",
};

const WARNING_META: Record<
  WeeklyBriefingWarning["severity"],
  { icon: LucideIcon; color: string }
> = {
  info: { icon: Info, color: "#60A5FA" },
  warning: { icon: AlertTriangle, color: "#EAB308" },
  alert: { icon: AlertTriangle, color: "#EF4444" },
};

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const f = (d: Date) =>
    d.toLocaleDateString("de-CH", { day: "2-digit", month: "short" });
  return `${f(s)} – ${f(e)}`;
}

export interface WeeklyBriefingCardData {
  isoWeek: string;
  weekStart: string;
  weekEnd: string;
  summary: string;
  highlights: WeeklyBriefing["highlights"];
  warnings: WeeklyBriefing["warnings"];
  suggestions: WeeklyBriefing["suggestions"];
  recap: WeeklyRecap;
  generatedAt: string;
}

/**
 * Presentational card — used on /training-load and inside the modal.
 * Layout differs only marginally between the two, so we keep a single
 * component and let the parent pick the wrapper.
 */
export function WeeklyBriefingCard({ data }: { data: WeeklyBriefingCardData }) {
  const weekNum = data.isoWeek.split("-")[1] ?? data.isoWeek;
  const sorted = [...data.suggestions].sort(
    (a, b) => a.dayOffset - b.dayOffset
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div
            className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3]`}
          >
            Wochen-Briefing · KW {weekNum}
          </div>
          <div
            className={`${rajdhani.className} text-2xl font-bold leading-tight`}
            style={{ color: NEON }}
          >
            {formatWeekRange(data.weekStart, data.weekEnd)}
          </div>
        </div>
        <RecapStats recap={data.recap} />
      </header>

      <p className="text-sm leading-relaxed text-[#e5e5e5]">{data.summary}</p>

      {data.highlights.length > 0 && (
        <div>
          <SectionLabel label="Highlights" />
          <ul className="mt-2 flex flex-col gap-1.5">
            {data.highlights.map((h, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs leading-relaxed text-[#d4d4d4]"
              >
                <CheckCircle2
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  style={{ color: "#22C55E" }}
                />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.warnings.length > 0 && (
        <div>
          <SectionLabel label="Achtung" />
          <ul className="mt-2 flex flex-col gap-1.5">
            {data.warnings.map((w, i) => {
              const meta = WARNING_META[w.severity];
              const WarnIcon = meta.icon;
              return (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs leading-relaxed"
                  style={{
                    color: "#e5e5e5",
                    background: `${meta.color}12`,
                    borderColor: `${meta.color}33`,
                  }}
                >
                  <WarnIcon
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    style={{ color: meta.color }}
                  />
                  <span>{w.message}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <SectionLabel label="Plan für kommende Woche" />
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {sorted.map((s) => (
            <DayRow key={s.dayOffset} suggestion={s} />
          ))}
        </div>
      </div>

      <div
        className={`${spaceMono.className} text-[9px] uppercase tracking-[0.14em] text-[#737373]`}
      >
        Generiert {formatRelativeDate(data.generatedAt)}
      </div>
    </div>
  );
}

function DayRow({ suggestion }: { suggestion: WeeklyBriefingSuggestion }) {
  const sport = SPORT_META[suggestion.sport];
  const SportIcon = sport.icon;
  const intensityColor = INTENSITY_COLOR[suggestion.intensity];
  const weekdayShort = WEEKDAY_SHORT[suggestion.weekday];
  const isRest = suggestion.isRestDay || suggestion.sport === "REST";

  return (
    <div
      className="flex items-start gap-3 rounded-lg border px-3 py-2.5"
      style={{
        borderColor: isRest ? "#2a2a2a" : `${sport.accent}33`,
        background: isRest ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.4)",
      }}
    >
      <div
        className={`${rajdhani.className} flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md text-center`}
        style={{
          background: `${sport.accent}14`,
          border: `1px solid ${sport.accent}33`,
          color: sport.accent,
        }}
      >
        <span className="text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-[#a3a3a3]">
          {weekdayShort}
        </span>
        <SportIcon className="mt-0.5 h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`${rajdhani.className} text-lg font-bold leading-tight text-white truncate`}
          >
            {suggestion.title}
          </p>
          {!isRest && (
            <span
              className={`${spaceMono.className} shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] tabular-nums`}
              style={{
                color: intensityColor,
                background: `${intensityColor}1a`,
                border: `1px solid ${intensityColor}44`,
              }}
            >
              {suggestion.intensity}
            </span>
          )}
        </div>
        <div
          className={`${spaceMono.className} mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[#a3a3a3]`}
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
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[#d4d4d4]">
          {suggestion.reasoning}
        </p>
      </div>
    </div>
  );
}

function RecapStats({ recap }: { recap: WeeklyRecap }) {
  return (
    <div
      className={`${spaceMono.className} flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3] tabular-nums`}
    >
      <Stat label="Einh." value={recap.activityCount} />
      <Stat label="Std" value={recap.totalHours} />
      <Stat label="km" value={recap.totalDistanceKm} />
      {recap.sleep.avgScore != null && (
        <Stat label="Schlaf" value={Math.round(recap.sleep.avgScore)} />
      )}
      {recap.weight.deltaKg != null && (
        <Stat
          label="Gew."
          value={`${recap.weight.deltaKg > 0 ? "+" : ""}${recap.weight.deltaKg} kg`}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span>
      <span className="font-bold text-white">{value}</span>
      <span className="ml-1 text-[#737373]">{label}</span>
    </span>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
    >
      {label}
    </div>
  );
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
