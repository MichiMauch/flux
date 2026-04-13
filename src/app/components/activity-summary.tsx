import Image from "next/image";
import {
  Activity,
  Bike,
  Clock,
  Droplets,
  Flame,
  Footprints,
  Gauge,
  Heart,
  Mountain,
  Thermometer,
  Wind,
} from "lucide-react";
import { ActivityTitle } from "./activity-title";
import { HrZonesChart } from "./hr-zones-chart";
import { windDirection, wmoEmoji, type WeatherData } from "@/lib/weather";
import { interpretTrimp } from "@/lib/trimp";
import type { HrSample } from "@/lib/hr-zones";

interface Photo {
  id: string;
  location: string | null;
}

interface ActivitySummaryProps {
  activity: {
    id: string;
    name: string;
    type: string;
    startTime: Date;
    duration: number | null;
    movingTime: number | null;
    distance: number | null;
    calories: number | null;
    avgHeartRate: number | null;
    maxHeartRate: number | null;
    ascent: number | null;
    descent: number | null;
    avgCadence: number | null;
    totalSteps: number | null;
    avgSpeed: number | null;
    cardioLoad: number | null;
    trimp: number | null;
    fatPercentage: number | null;
    carbPercentage: number | null;
    proteinPercentage: number | null;
    device: string | null;
  };
  userName: string | null;
  photos: Photo[];
  weather: WeatherData | null;
  isOwner: boolean;
  heartRateData?: HrSample[];
  userProfile?: {
    sex?: "male" | "female" | null;
    birthday?: Date | string | null;
    maxHeartRate?: number | null;
    restHeartRate?: number | null;
    aerobicThreshold?: number | null;
    anaerobicThreshold?: number | null;
  };
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "–";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDistance(meters: number | null): string {
  if (meters == null) return "–";
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)}`;
  return `${Math.round(meters)}`;
}

function formatPace(meters: number | null, seconds: number | null): string {
  if (!meters || !seconds) return "–";
  const paceSeconds = seconds / (meters / 1000);
  const m = Math.floor(paceSeconds / 60);
  const s = Math.round(paceSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function activityTypeLabel(type: string): string {
  const t = type.toUpperCase();
  if (t === "RUNNING") return "Laufen";
  if (t === "CYCLING") return "Rad";
  if (t === "WALKING") return "Gehen";
  if (t === "HIKING") return "Wandern";
  return type;
}

function typeIcon(type: string) {
  const t = type.toUpperCase();
  if (t === "CYCLING") return <Bike className="h-3 w-3" />;
  if (t === "RUNNING") return <Footprints className="h-3 w-3" />;
  return <Activity className="h-3 w-3" />;
}

export function ActivitySummary({
  activity,
  userName,
  photos,
  weather,
  isOwner,
  heartRateData,
  userProfile,
}: ActivitySummaryProps) {
  const isRunning = activity.type.toUpperCase() === "RUNNING";
  const locationLabel = photos.find((p) => p.location)?.location ?? null;
  const hasMacros = activity.fatPercentage != null;

  const dateLabel = activity.startTime.toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeLabel = activity.startTime.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <div className="grid md:grid-cols-[minmax(280px,0.8fr)_1px_1.2fr]">
        {/* LEFT */}
        <div className="p-4 border-b md:border-b-0 border-border flex flex-col">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-brand-soft text-brand-dark">
              {typeIcon(activity.type)}
              {activityTypeLabel(activity.type)}
            </span>
            <span>
              {dateLabel} · {timeLabel}
              {locationLabel ? ` · ${locationLabel}` : ""}
            </span>
          </div>
          {isOwner ? (
            <ActivityTitle activityId={activity.id} initialName={activity.name} />
          ) : (
            <h1 className="text-xl font-bold tracking-[-0.025em] leading-tight">
              {activity.name}
            </h1>
          )}
          {userName && (
            <p className="text-xs text-muted-foreground mt-1">{userName}</p>
          )}

          {photos.length > 0 && (
            <div className="mt-3 flex gap-1 overflow-x-auto scrollbar-none">
              {photos.slice(0, 6).map((p) => (
                <a
                  key={p.id}
                  href={`#photo=${p.id}`}
                  className="flex-shrink-0 block rounded-sm overflow-hidden hover:opacity-90 transition-opacity"
                  style={{ width: 56, height: 56 }}
                >
                  <Image
                    src={`/api/photos/${p.id}?thumb=1`}
                    alt=""
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </a>
              ))}
              {photos.length > 6 && (
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-sm bg-surface text-foreground border border-border text-xs font-bold"
                  style={{ width: 56, height: 56 }}
                >
                  +{photos.length - 6}
                </div>
              )}
            </div>
          )}

          <div className="mt-auto">
            {weather && (
              <div className="pt-3 border-t border-border">
                <div className="grid grid-cols-4 gap-2 tabular-nums">
                  <WeatherItem
                    icon={<span className="text-base leading-none">{wmoEmoji(weather.icon)}</span>}
                    value={weather.description}
                    isLabel
                  />
                  <WeatherItem
                    icon={<Thermometer className="h-3.5 w-3.5 text-muted-foreground" />}
                    value={`${weather.temp.toFixed(0)}°C`}
                  />
                  <WeatherItem
                    icon={<Wind className="h-3.5 w-3.5 text-muted-foreground" />}
                    value={`${Math.round(weather.windSpeed)} km/h ${windDirection(weather.windDeg)}`}
                  />
                  <WeatherItem
                    icon={<Droplets className="h-3.5 w-3.5 text-muted-foreground" />}
                    value={`${weather.humidity}%`}
                  />
                </div>
              </div>
            )}

            {activity.trimp != null && activity.trimp > 0 && (
              <TrimpInline
                trimp={activity.trimp}
                durationSec={activity.duration}
                className="border-t border-border"
              />
            )}
          </div>
        </div>

        {/* divider */}
        <div className="hidden md:block bg-border" />

        {/* RIGHT */}
        <div className="flex flex-col">
          {/* Hero: Bewegungszeit · Distanz · Aufstieg */}
          <div className="grid grid-cols-3 px-4 pt-4 pb-3 border-b border-border">
            <HeroStat
              value={formatDuration(activity.movingTime ?? activity.duration)}
              unit=""
              label="Bewegungszeit"
            />
            <HeroStat
              value={formatDistance(activity.distance)}
              unit={activity.distance != null && activity.distance >= 1000 ? "km" : "m"}
              label="Distanz"
              withDivider
            />
            <HeroStat
              value={activity.ascent != null ? `${Math.round(activity.ascent)}` : "–"}
              unit={activity.ascent != null ? "m" : ""}
              label="Aufstieg"
              withDivider
            />
          </div>

          {/* Mini grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 border-b border-border">
            {activity.descent != null && activity.descent > 0 && (
              <Mini icon={<Mountain />} label="Abstieg" value={`${Math.round(activity.descent)}`} unit="m" />
            )}
            {activity.distance != null && activity.duration != null && (
              <Mini
                icon={isRunning ? <Footprints /> : <Gauge />}
                label={isRunning ? "Pace" : "Ø Speed"}
                value={
                  isRunning
                    ? formatPace(activity.distance, activity.duration)
                    : ((activity.distance / 1000) / (activity.duration / 3600)).toFixed(1)
                }
                unit={isRunning ? "/km" : "km/h"}
              />
            )}
            {activity.maxHeartRate != null && (
              <Mini icon={<Heart />} label="Max Puls" value={`${activity.maxHeartRate}`} unit="bpm" />
            )}
            {activity.avgHeartRate != null && (
              <Mini icon={<Heart />} label="Ø Puls" value={`${activity.avgHeartRate}`} unit="bpm" />
            )}
            {activity.avgCadence != null && (
              <Mini icon={<Footprints />} label="Kadenz" value={`${activity.avgCadence}`} unit="spm" />
            )}
            {activity.totalSteps != null && activity.totalSteps > 0 && (
              <Mini
                icon={<Footprints />}
                label="Schritte"
                value={activity.totalSteps.toLocaleString("de-CH")}
                unit=""
              />
            )}
            {activity.calories != null && (
              <Mini icon={<Flame />} label="Kalorien" value={`${activity.calories}`} unit="kcal" />
            )}
            {activity.duration != null && (
              <Mini icon={<Clock />} label="Gesamtzeit" value={formatDuration(activity.duration)} unit="" />
            )}
            {activity.cardioLoad != null && activity.cardioLoad > 0 && (
              <Mini
                icon={<Activity />}
                label="Cardio Load"
                value={activity.cardioLoad.toFixed(0)}
                unit=""
              />
            )}
            {hasMacros && (
              <MacroTile
                carb={activity.carbPercentage ?? 0}
                fat={activity.fatPercentage ?? 0}
                protein={activity.proteinPercentage ?? 0}
              />
            )}
          </div>

          {/* HR zones */}
          {heartRateData && heartRateData.length > 1 && userProfile && (
            <HrZonesChart samples={heartRateData} user={userProfile} />
          )}

          {/* Footer meta */}
          {activity.device && (
            <div className="px-4 py-1.5 text-[10px] text-muted-foreground font-mono flex gap-2 flex-wrap border-t border-border">
              <span>{activity.device}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroStat({
  value,
  unit,
  label,
  withDivider,
}: {
  value: string;
  unit: string;
  label: string;
  withDivider?: boolean;
}) {
  return (
    <div className={`min-w-0 ${withDivider ? "border-l border-border pl-3" : ""}`}>
      <div className="flex items-baseline gap-1 tabular-nums">
        <span className="text-[clamp(22px,3.2vw,30px)] font-bold tracking-[-0.03em] leading-none">
          {value}
        </span>
        {unit && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}
      </div>
      <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Mini({
  icon,
  label,
  value,
  unit,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-r border-b border-border last:border-r-0 [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r sm:[&:nth-child(3n)]:border-r-0 md:[&:nth-child(3n)]:border-r md:[&:nth-child(4n)]:border-r-0 -mr-px -mb-px">
      <span className={`flex-shrink-0 ${highlight ? "text-brand" : "text-muted-foreground"}`}>
        <span className="[&>svg]:w-3 [&>svg]:h-3">{icon}</span>
      </span>
      <div className="min-w-0">
        <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground leading-tight">
          {label}
        </div>
        <div className="flex items-baseline gap-0.5 mt-0.5 tabular-nums">
          <span
            className={`text-sm font-bold tracking-[-0.02em] leading-none ${
              highlight ? "text-brand" : ""
            }`}
          >
            {value}
          </span>
          {unit && <span className="text-[10px] font-medium text-muted-foreground">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

const TRIMP_ZONES = [
  { to: 100, color: "#FFD9CC" },
  { to: 200, color: "#FFB199" },
  { to: 400, color: "#FF8466" },
  { to: 500, color: "#C73A1E" },
];
const TRIMP_MAX = 500;
const INTENSITY_ZONES = [
  { to: 60, color: "#FFD9CC" },
  { to: 120, color: "#FFB199" },
  { to: 180, color: "#FF8466" },
  { to: 240, color: "#C73A1E" },
];
const INTENSITY_MAX = 240;

function TrimpInline({
  trimp,
  durationSec,
  className,
}: {
  trimp: number;
  durationSec: number | null;
  className?: string;
}) {
  const label = interpretTrimp(trimp);
  const overflow = trimp > TRIMP_MAX;
  const capped = Math.min(trimp, TRIMP_MAX);
  const markerPct = (capped / TRIMP_MAX) * 100;
  const activeZone = zoneFor(trimp, TRIMP_ZONES, TRIMP_MAX);
  const hours = durationSec ? durationSec / 3600 : null;
  const perHour = hours && hours > 0 ? trimp / hours : null;
  const perHourCapped = perHour != null ? Math.min(perHour, INTENSITY_MAX) : null;
  const perHourPct =
    perHourCapped != null ? (perHourCapped / INTENSITY_MAX) * 100 : 0;
  const activeIntensity =
    perHour != null ? zoneFor(perHour, INTENSITY_ZONES, INTENSITY_MAX) : null;

  return (
    <div className={`px-4 py-3 space-y-3 ${className ?? "border-t border-border"}`}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <Activity className="h-3 w-3" />
        TRIMP · Cardio Load
      </div>

      {/* Gesamtlast */}
      <div>
        <div className="flex items-end justify-between mb-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Gesamtlast
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium" style={{ color: activeZone.color }}>
              {label}
            </span>
            <span className="text-base font-bold tabular-nums">
              {overflow ? ">" : ""}
              {Math.round(trimp)}
            </span>
          </div>
        </div>
        <div className="relative">
          <div className="flex h-1.5 rounded overflow-hidden">
            {TRIMP_ZONES.map((z, i) => {
              const from = i === 0 ? 0 : TRIMP_ZONES[i - 1].to;
              return (
                <div
                  key={z.to}
                  style={{
                    width: `${((z.to - from) / TRIMP_MAX) * 100}%`,
                    background: z.color,
                    opacity: z.color === activeZone.color ? 1 : 0.35,
                  }}
                />
              );
            })}
          </div>
          <div
            className="absolute -top-0.5 h-2.5 w-0.5 bg-foreground"
            style={{ left: `calc(${markerPct}% - 1px)` }}
          />
        </div>
      </div>

      {/* Intensität */}
      {perHour != null && activeIntensity && (
        <div>
          <div className="flex items-end justify-between mb-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Intensität · TRIMP/h
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium" style={{ color: activeIntensity.color }}>
                {interpretTrimp(perHour)}
              </span>
              <span className="text-base font-bold tabular-nums">
                {Math.round(perHour)}
                <span className="text-[10px] text-muted-foreground font-normal ml-0.5">/h</span>
              </span>
            </div>
          </div>
          <div className="relative">
            <div className="flex h-1.5 rounded overflow-hidden">
              {INTENSITY_ZONES.map((z, i) => {
                const from = i === 0 ? 0 : INTENSITY_ZONES[i - 1].to;
                return (
                  <div
                    key={z.to}
                    style={{
                      width: `${((z.to - from) / INTENSITY_MAX) * 100}%`,
                      background: z.color,
                      opacity: z.color === activeIntensity.color ? 1 : 0.35,
                    }}
                  />
                );
              })}
            </div>
            <div
              className="absolute -top-0.5 h-2.5 w-0.5 bg-foreground"
              style={{ left: `calc(${perHourPct}% - 1px)` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function zoneFor(
  value: number,
  zones: { to: number; color: string }[],
  max: number
) {
  for (let i = 0; i < zones.length; i++) {
    const from = i === 0 ? 0 : zones[i - 1].to;
    if (value >= from && value < zones[i].to) return zones[i];
  }
  return zones[zones.length - 1];
}

function WeatherItem({
  icon,
  value,
  isLabel,
}: {
  icon: React.ReactNode;
  value: string;
  isLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="flex-shrink-0">{icon}</span>
      <span
        className={`text-xs truncate ${isLabel ? "text-muted-foreground capitalize" : "font-semibold"}`}
      >
        {value}
      </span>
    </div>
  );
}

function MacroTile({
  carb,
  fat,
  protein,
}: {
  carb: number;
  fat: number;
  protein: number;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 col-span-2 border-b border-border -mb-px">
      <span className="flex-shrink-0 text-muted-foreground">
        <Flame className="w-3 h-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground leading-tight">
          KH · Fett · Eiweiss
        </div>
        <div className="flex h-1 rounded-full overflow-hidden mt-1 bg-surface">
          <div style={{ width: `${carb}%`, background: "#FFB199" }} />
          <div style={{ width: `${fat}%`, background: "#F0E4D4" }} />
          <div style={{ width: `${protein}%`, background: "#C73A1E" }} />
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
          {carb}/{fat}/{protein}
        </div>
      </div>
    </div>
  );
}
