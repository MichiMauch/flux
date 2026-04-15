import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  activities,
  users,
  activityPhotos,
  userTrophies,
} from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { computeLevel } from "@/lib/trophies-server";
import { computeHrZones, formatZoneDuration, type HrZone } from "@/lib/hr-zones";
import { fetchHistoricalWeather, type WeatherData } from "@/lib/weather";
import { BentoNotesTile } from "@/app/components/bento/bento-notes-tile";
import { BentoWeatherTile } from "@/app/components/bento/bento-weather-tile";
import { BentoSplitsTable } from "@/app/components/bento/bento-splits-table";
import { ActivityActionsMenu } from "@/app/components/activity-actions-menu";
import { PhotoLightbox } from "@/app/components/photo-lightbox";
import { BentoRouteInteractive } from "@/app/components/bento/bento-route-interactive";
import { getTrophy, tierColor } from "@/lib/trophies";
import { TrophyIcon } from "@/app/components/trophy-icon";
import { ArrowLeft, Clock, Ruler, Mountain, Heart, Flame, Zap, Activity as ActivityIcon, Gauge, TrendingDown } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Rajdhani, Space_Mono } from "next/font/google";

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const NEON = "#FF6A00";
const NEON_DIM = "#b34600";

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return n.toLocaleString("de-CH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function km(m: number | null): string {
  if (m == null) return "–";
  return (m / 1000).toFixed(2);
}

interface RoutePoint {
  lat: number;
  lng: number;
  elevation?: number | null;
  time?: string;
}

function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function niceStep(range: number, targetTicks: number): number {
  const raw = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = n >= 5 ? 5 : n >= 2 ? 2 : 1;
  return step * mag;
}

function ElevationProfile({
  route,
  width = 900,
  height = 280,
}: {
  route: RoutePoint[];
  width?: number;
  height?: number;
}) {
  const pts = route.filter((p) => typeof p.elevation === "number");
  if (pts.length < 2) return null;

  // Cumulative distance per point
  const dist: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    dist.push(dist[i - 1] + haversineKm(pts[i - 1], pts[i]));
  }
  const totalKm = dist[dist.length - 1];

  const elevations = pts.map((p) => p.elevation as number);
  const minE = Math.min(...elevations);
  const maxE = Math.max(...elevations);
  const dy = Math.max(1, maxE - minE);

  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const xAt = (km: number) => padL + (km / Math.max(1e-6, totalKm)) * plotW;
  const yAt = (el: number) => padT + plotH - ((el - minE) / dy) * plotH;

  // Ticks
  const yStep = niceStep(dy, 4);
  const yTicks: number[] = [];
  const yStart = Math.ceil(minE / yStep) * yStep;
  for (let v = yStart; v <= maxE; v += yStep) yTicks.push(v);

  const xStep = niceStep(totalKm, 6);
  const xTicks: number[] = [];
  for (let v = 0; v <= totalKm + 1e-6; v += xStep) xTicks.push(v);

  let line = "";
  let area = `M${xAt(dist[0]).toFixed(1)},${(padT + plotH).toFixed(1)} `;
  pts.forEach((p, i) => {
    const x = xAt(dist[i]);
    const y = yAt(p.elevation as number);
    line += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
    area += `L${x.toFixed(1)},${y.toFixed(1)} `;
  });
  area += `L${xAt(totalKm).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <defs>
        <linearGradient id="elev-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={NEON} stopOpacity="0.45" />
          <stop offset="100%" stopColor={NEON} stopOpacity="0" />
        </linearGradient>
        <filter id="neon-glow">
          <feGaussianBlur stdDeviation="2.5" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Y grid */}
      {yTicks.map((v) => {
        const y = yAt(v);
        return (
          <g key={`y${v}`}>
            <line
              x1={padL}
              x2={width - padR}
              y1={y}
              y2={y}
              stroke="#1f1f1f"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <text
              x={padL - 6}
              y={y + 3}
              fontSize={10}
              textAnchor="end"
              fill="#6b6b6b"
              fontFamily="var(--font-jetbrains), monospace"
            >
              {Math.round(v)} m
            </text>
          </g>
        );
      })}

      {/* X grid */}
      {xTicks.map((v) => {
        const x = xAt(v);
        return (
          <g key={`x${v}`}>
            <line
              x1={x}
              x2={x}
              y1={padT}
              y2={padT + plotH}
              stroke="#1f1f1f"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <text
              x={x}
              y={padT + plotH + 14}
              fontSize={10}
              textAnchor="middle"
              fill="#6b6b6b"
              fontFamily="var(--font-jetbrains), monospace"
            >
              {v % 1 === 0 ? v : v.toFixed(1)} km
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH} stroke="#2a2a2a" strokeWidth={1} />
      <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="#2a2a2a" strokeWidth={1} />

      {/* Area + line */}
      <path d={area} fill="url(#elev-grad)" />
      <path
        d={line}
        fill="none"
        stroke={NEON}
        strokeWidth={2.5}
        filter="url(#neon-glow)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-4 ${className}`}>{children}</div>
  );
}

function TileLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${spaceMono.className} [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6b6b] mb-2`}
    >
      {children}
    </div>
  );
}

export default async function ActivityBentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;

  const result = await db
    .select()
    .from(activities)
    .innerJoin(users, eq(activities.userId, users.id))
    .where(eq(activities.id, id))
    .limit(1);
  if (result.length === 0) notFound();
  const activity = result[0].activities;
  const user = result[0].user;

  const photos = await db
    .select({
      id: activityPhotos.id,
      lat: activityPhotos.lat,
      lng: activityPhotos.lng,
      location: activityPhotos.location,
      takenAt: activityPhotos.takenAt,
    })
    .from(activityPhotos)
    .where(eq(activityPhotos.activityId, activity.id))
    .orderBy(activityPhotos.takenAt);

  const [level, recentTrophies] = await Promise.all([
    computeLevel(activity.userId),
    db
      .select({ code: userTrophies.trophyCode })
      .from(userTrophies)
      .where(eq(userTrophies.userId, activity.userId))
      .orderBy(desc(userTrophies.unlockedAt))
      .limit(4),
  ]);

  const route = (activity.routeData as RoutePoint[] | null) ?? [];
  const isRunning = activity.type?.toUpperCase() === "RUNNING";

  let weather = activity.weather as WeatherData | null;
  if (!weather && route.length > 0) {
    const first = route[0];
    if (first?.lat != null && first?.lng != null) {
      const fetched = await fetchHistoricalWeather(
        first.lat,
        first.lng,
        activity.startTime
      );
      if (fetched) {
        weather = fetched;
        await db
          .update(activities)
          .set({ weather: fetched, weatherFetchedAt: new Date() })
          .where(eq(activities.id, activity.id));
      }
    }
  }

  const hr = (activity.heartRateData as { time: string; bpm: number }[] | null) ?? [];
  const hrZones = computeHrZones(hr, {
    sex: user.sex as "male" | "female" | null,
    birthday: user.birthday,
    maxHeartRate: user.maxHeartRate,
    restHeartRate: user.restHeartRate,
    aerobicThreshold: user.aerobicThreshold,
    anaerobicThreshold: user.anaerobicThreshold,
  });

  const isOwner = activity.userId === session.user.id;

  const duration = activity.movingTime ?? activity.duration ?? 0;
  const distanceKm = km(activity.distance);
  const ascent = activity.ascent != null ? Math.round(activity.ascent) : null;
  const descent = activity.descent != null ? Math.round(activity.descent) : null;
  const calories = activity.calories;
  const avgHr = activity.avgHeartRate;
  const maxHr = activity.maxHeartRate;
  const avgCadence = activity.avgCadence;
  const cardioLoad = activity.cardioLoad;
  const trimp = activity.trimp;
  const avgSpeed = activity.avgSpeed;

  const dateLabel = activity.startTime.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="dark min-h-screen bg-black text-white"
      style={{
        fontFeatureSettings: '"ss01", "cv11"',
        ["--bento-mono" as string]: spaceMono.style.fontFamily,
      }}
    >
      <main className="mx-auto w-full max-w-7xl px-4 py-6 space-y-3">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1 [font-family:var(--bento-mono)] text-xs text-[#6b6b6b] hover:text-white uppercase tracking-[0.16em] font-bold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück
          </Link>
          <Link
            href={`/activity/${id}/classic`}
            className="[font-family:var(--bento-mono)] text-[10px] uppercase tracking-[0.16em] text-[#6b6b6b] hover:text-white"
          >
            Klassische Ansicht
          </Link>
        </div>

        {/* Title banner */}
        <Tile className="relative overflow-hidden">
          <TileLabel>Aktivität · {dateLabel}</TileLabel>
          <h1
            className={`${rajdhani.className} font-bold uppercase leading-[0.95] tracking-[-0.01em] break-words pr-10`}
            style={{
              fontSize: "clamp(48px, 8vw, 100px)",
              color: NEON,
              textShadow: `0 0 18px ${NEON}66, 0 0 36px ${NEON}33`,
            }}
          >
            {activity.name}
          </h1>
          {isOwner && (
            <div className="absolute top-3 right-3">
              <ActivityActionsMenu
                activity={{
                  id: activity.id,
                  name: activity.name,
                  notes: activity.notes,
                  ascent: activity.ascent,
                  descent: activity.descent,
                }}
                initialPhotos={photos.map((p) => ({ id: p.id }))}
              />
            </div>
          )}
        </Tile>

        {/* Giant metrics */}
        <Tile>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <SevenSegTile
              icon={<Clock />}
              value={duration > 0 ? formatDuration(duration) : "–"}
              label="Zeit"
            />
            <SevenSegTile icon={<Ruler />} value={distanceKm} suffix="km" label="Distanz" />
            <SevenSegTile
              icon={<Mountain />}
              value={fmt(ascent)}
              suffix="m"
              label="Aufstieg"
            />
            <SevenSegTile
              icon={<Flame />}
              value={fmt(calories)}
              suffix="kcal"
              label="Kalorien"
            />
          </div>
        </Tile>

        {/* Map (left) + stat grid + elevation (right) */}
        <div className="grid gap-3 lg:grid-cols-2 items-stretch">
          {route.length > 0 ? (
            <BentoRouteInteractive
              routeData={route}
              heartRateData={hr}
              totalDistance={activity.distance}
              totalAscent={activity.ascent}
              totalDescent={activity.descent}
              isRunning={isRunning}
              photos={photos
                .filter((p) => p.lat != null && p.lng != null)
                .map((p) => ({ id: p.id, lat: p.lat as number, lng: p.lng as number }))}
            />
          ) : (
            <Tile className="p-2 overflow-hidden">
              <div className="h-[560px] flex items-center justify-center text-[#555] text-xs uppercase tracking-[0.16em]">
                keine Route
              </div>
            </Tile>
          )}

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              {hrZones && (
                <div className="col-span-3">
                  <HrZonesTile zones={hrZones.zones} />
                </div>
              )}
              <StatTile icon={<Heart />} label="Ø Puls" value={fmt(avgHr)} unit="bpm" />
              <StatTile icon={<Heart />} label="Max Puls" value={fmt(maxHr)} unit="bpm" />
              <GiantTile
                label="Abstieg"
                value={fmt(descent)}
                unit="m"
                icon={<TrendingDown />}
              />
              <DotsTile
                icon={<Zap />}
                label="TRIMP"
                value={fmt(trimp != null ? Math.round(trimp) : null)}
                count={trimp != null ? dotsForTrimp(trimp) : 0}
              />
              <DotsTile
                icon={<Gauge />}
                label="Cardio-Load"
                value={fmt(cardioLoad, 1)}
                count={cardioLoad != null ? dotsForCardioLoad(cardioLoad) : 0}
              />
              <StatTile
                icon={<ActivityIcon />}
                label="Ø Tempo"
                value={fmt(avgSpeed != null ? avgSpeed * 3.6 : null, 1)}
                unit="km/h"
              />
            </div>

            <Tile className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <TileLabel>Höhenprofil</TileLabel>
                <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b6b]">
                  Aufstieg{" "}
                  <span className="text-white tabular-nums">
                    {ascent != null ? `${ascent} m` : "–"}
                  </span>
                </div>
              </div>
              <div className="h-[240px]">
                <ElevationProfile route={route} />
              </div>
            </Tile>

            {avgCadence != null && (
              <StatTile icon={<ActivityIcon />} label="Ø Kadenz" value={fmt(avgCadence)} unit="rpm" />
            )}
          </div>
        </div>

        {/* Level + Trophies + Photos */}
        <div className="grid gap-3 md:grid-cols-3">
          <Tile>
            <TileLabel>Level</TileLabel>
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `${NEON}14`,
                  border: `1px solid ${NEON}55`,
                  fontSize: "38px",
                }}
              >
                <SevenSegDisplay value={String(level.level)} on={NEON} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="[font-family:var(--bento-mono)] text-xs text-[#9ca3af] tabular-nums">
                  {Math.round(level.xpIntoLevel)} / {Math.round(level.xpForNextLevel)} XP
                </div>
                <div className="relative mt-2 h-2 rounded-full bg-[#1f1f1f] overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${Math.min(100, level.progressPct)}%`,
                      background: NEON,
                      boxShadow: `0 0 10px ${NEON}`,
                    }}
                  />
                </div>
              </div>
            </div>
          </Tile>

          <Tile>
            <TileLabel>Trophäen</TileLabel>
            <div className="flex gap-2">
              {recentTrophies.length === 0 && (
                <div className="text-xs text-[#6b6b6b]">noch keine</div>
              )}
              {recentTrophies.map((t) => {
                const def = getTrophy(t.code);
                if (!def) return null;
                return (
                  <div
                    key={t.code}
                    className="flex h-14 w-14 items-center justify-center rounded-lg border border-[#1f1f1f] bg-[#0a0a0a]"
                    title={def.title}
                  >
                    <TrophyIcon name={def.icon} className={`h-6 w-6 ${tierColor(def.tier)}`} />
                  </div>
                );
              })}
            </div>
          </Tile>

          <Tile>
            <TileLabel>Fotos · {photos.length}</TileLabel>
            {photos.length === 0 ? (
              <div className="text-xs text-[#6b6b6b]">Keine Fotos</div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {photos.slice(0, 8).map((p) => (
                  <a
                    key={p.id}
                    href={`#photo=${p.id}`}
                    className="relative aspect-square overflow-hidden rounded-md border border-[#1f1f1f] hover:border-[#3a3a3a] transition-colors"
                  >
                    <Image
                      src={`/api/photos/${p.id}?thumb=1`}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized
                    />
                  </a>
                ))}
              </div>
            )}
          </Tile>
        </div>

        {(activity.notes || weather) && (
          <div className="grid gap-3 md:grid-cols-2">
            <BentoNotesTile notes={activity.notes} />
            <BentoWeatherTile weather={weather} />
          </div>
        )}

        {route.length > 0 && (
          <BentoSplitsTable
            routeData={route}
            heartRateData={hr}
            isRunning={isRunning}
            totalDistanceMeters={activity.distance}
            totalAscent={activity.ascent}
            totalDescent={activity.descent}
          />
        )}
      </main>
      {photos.length > 0 && <PhotoLightbox photos={photos} />}
    </div>
  );
}

// 7-segment digit rendering (SVG). Segments labelled a..g.
// Digit viewBox: 60 x 100
const SEG_MAP: Record<string, string[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
  "-": ["g"],
  " ": [],
};

function horizSeg(cx: number, cy: number, w: number, t: number): string {
  const h = w / 2;
  const th = t / 2;
  return [
    [cx - h, cy],
    [cx - h + th, cy - th],
    [cx + h - th, cy - th],
    [cx + h, cy],
    [cx + h - th, cy + th],
    [cx - h + th, cy + th],
  ]
    .map((p) => p.join(","))
    .join(" ");
}

function vertSeg(cx: number, cy: number, h: number, t: number): string {
  const hh = h / 2;
  const th = t / 2;
  return [
    [cx, cy - hh],
    [cx + th, cy - hh + th],
    [cx + th, cy + hh - th],
    [cx, cy + hh],
    [cx - th, cy + hh - th],
    [cx - th, cy - hh + th],
  ]
    .map((p) => p.join(","))
    .join(" ");
}

function SevenSegDigit({ char, on, off }: { char: string; on: string; off: string }) {
  const t = 9;
  const hW = 40;
  const vH = 40;
  const segs: Record<string, string> = {
    a: horizSeg(30, 6, hW, t),
    g: horizSeg(30, 50, hW, t),
    d: horizSeg(30, 94, hW, t),
    f: vertSeg(6, 28, vH, t),
    b: vertSeg(54, 28, vH, t),
    e: vertSeg(6, 72, vH, t),
    c: vertSeg(54, 72, vH, t),
  };
  const active = SEG_MAP[char] ?? [];
  return (
    <svg viewBox="-2 -2 64 104" width="0.6em" height="1em" style={{ overflow: "visible" }}>
      {Object.entries(segs).map(([k, pts]) => {
        const isOn = active.includes(k);
        return (
          <polygon
            key={k}
            points={pts}
            fill={isOn ? on : off}
            style={
              isOn
                ? { filter: `drop-shadow(0 0 4px ${on}) drop-shadow(0 0 8px ${on}aa)` }
                : undefined
            }
          />
        );
      })}
    </svg>
  );
}

function SevenSegColon({ on }: { on: string }) {
  return (
    <svg viewBox="-2 -2 20 104" width="0.22em" height="1em" style={{ overflow: "visible" }}>
      <circle cx="8" cy="36" r="5" fill={on} style={{ filter: `drop-shadow(0 0 4px ${on})` }} />
      <circle cx="8" cy="64" r="5" fill={on} style={{ filter: `drop-shadow(0 0 4px ${on})` }} />
    </svg>
  );
}

function SevenSegDot({ on }: { on: string }) {
  // period/comma: small square at bottom-right
  return (
    <svg viewBox="-2 -2 20 104" width="0.22em" height="1em" style={{ overflow: "visible" }}>
      <rect x="3" y="87" width="10" height="10" fill={on} style={{ filter: `drop-shadow(0 0 4px ${on})` }} />
    </svg>
  );
}

function SevenSegApos({ on }: { on: string }) {
  // thousand separator: small square top-right
  return (
    <svg viewBox="-2 -2 14 104" width="0.14em" height="1em" style={{ overflow: "visible" }}>
      <rect x="3" y="8" width="6" height="14" fill={on} style={{ filter: `drop-shadow(0 0 4px ${on})` }} />
    </svg>
  );
}

function SevenSegDisplay({
  value,
  on = "#ffffff",
  off = "#1a1a1a",
}: {
  value: string;
  on?: string;
  off?: string;
}) {
  return (
    <div className="inline-flex items-center gap-[0.08em] leading-none">
      {value.split("").map((ch, i) => {
        if (ch === ":") return <SevenSegColon key={i} on={on} />;
        if (ch === "." || ch === ",") return <SevenSegDot key={i} on={on} />;
        if (ch === "'" || ch === "\u2019") return <SevenSegApos key={i} on={on} />;
        return <SevenSegDigit key={i} char={ch} on={on} off={off} />;
      })}
    </div>
  );
}

function SevenSegTile({
  icon,
  value,
  label,
  suffix,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6b6b] mb-2">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        {label}
      </div>
      <div
        className="flex items-end gap-2 leading-none"
        style={{ fontSize: "clamp(36px, 4vw, 56px)" }}
      >
        <SevenSegDisplay value={value} />
        {suffix && (
          <span
            className="[font-family:var(--bento-mono)] font-bold text-[0.4em] lowercase pb-[0.15em]"
            style={{ color: NEON }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function MetricBig({
  icon,
  value,
  suffix,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  suffix?: string;
  label: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6b6b] mb-1">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        {label}
      </div>
      <div
        className="font-black leading-none tabular-nums tracking-[-0.03em] flex items-baseline gap-2 text-white"
        style={{
          fontSize: "clamp(34px, 4.5vw, 64px)",
          textShadow: `0 0 14px ${NEON}66`,
        }}
      >
        <span>{value}</span>
        {suffix && (
          <span className="font-bold text-[0.45em]" style={{ color: NEON }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <Tile>
      <div className="flex items-center gap-1.5 [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b6b] mb-2">
        <span className="[&>svg]:h-3 [&>svg]:w-3" style={{ color: NEON_DIM }}>
          {icon}
        </span>
        {label}
      </div>
      <div className="flex items-end gap-1.5 leading-none" style={{ fontSize: "28px" }}>
        <SevenSegDisplay value={value} />
        {unit && (
          <span
            className="[font-family:var(--bento-mono)] font-bold text-[0.4em] lowercase pb-[0.15em]"
            style={{ color: NEON }}
          >
            {unit}
          </span>
        )}
      </div>
    </Tile>
  );
}

const ZONE_NEON = ["#38BDF8", "#39FF14", "#FDE047", "#F97316", "#EC4899"];
const ZONE_LABEL_SHORT = ["Z1 Regen", "Z2 Aerob light", "Z3 Aerob", "Z4 Schwelle", "Z5 Anaerob"];

function HrZonesTile({ zones }: { zones: HrZone[] }) {
  // Order Z5 top → Z1 bottom, like target screenshot
  const ordered = [...zones].reverse();
  const max = Math.max(...zones.map((z) => z.seconds), 1);
  return (
    <Tile className="flex flex-col">
      <TileLabel>Herzfrequenz-Zonen</TileLabel>
      <div className="flex flex-col gap-2 mt-1">
        {ordered.map((z) => {
          const color = ZONE_NEON[z.index - 1];
          const w = Math.max(2, (z.seconds / max) * 100);
          return (
            <div key={z.index} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af] w-24">
                {ZONE_LABEL_SHORT[z.index - 1]}
              </div>
              <div className="relative h-4 rounded-sm bg-[#151515] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{
                    width: `${w}%`,
                    background: color,
                    boxShadow: `0 0 8px ${color}99`,
                  }}
                />
              </div>
              <div className="[font-family:var(--bento-mono)] text-[11px] tabular-nums flex items-center gap-2 min-w-[110px] justify-end">
                <span className="text-[#9ca3af]">
                  {z.minBpm}–{z.maxBpm}
                </span>
                <span className="font-bold text-white">{formatZoneDuration(z.seconds)}</span>
                <span className="text-[#6b6b6b] w-12 text-right">
                  {z.percent.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Tile>
  );
}

function dotsForTrimp(v: number): number {
  if (v < 50) return 1;
  if (v < 100) return 2;
  if (v < 200) return 3;
  if (v < 400) return 4;
  return 5;
}

function dotsForCardioLoad(v: number): number {
  if (v < 1) return 1;
  if (v < 2) return 2;
  if (v < 4) return 3;
  if (v < 6) return 4;
  return 5;
}

function DotsTile({
  label,
  value,
  count,
  icon,
}: {
  label: string;
  value: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <Tile>
      <div className="flex items-center gap-1.5 [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b6b] mb-2">
        {icon && (
          <span className="[&>svg]:h-3 [&>svg]:w-3" style={{ color: NEON_DIM }}>
            {icon}
          </span>
        )}
        {label}
      </div>
      <div className="flex items-center gap-2 mb-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background: i < count ? NEON : "#1f1f1f",
              boxShadow: i < count ? `0 0 6px ${NEON}99` : "inset 0 0 0 1px #2a2a2a",
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: "22px" }}>
        <SevenSegDisplay value={value} />
      </div>
    </Tile>
  );
}

function GiantTile({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Tile className="flex flex-col justify-between">
      <div className="flex items-center gap-1.5 [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b6b]">
        {icon && (
          <span className="[&>svg]:h-3 [&>svg]:w-3" style={{ color: NEON_DIM }}>
            {icon}
          </span>
        )}
        {label}
      </div>
      <div
        className="flex items-end gap-2 leading-none"
        style={{ fontSize: "clamp(32px, 3.4vw, 48px)" }}
      >
        <SevenSegDisplay value={value} />
        {unit && (
          <span
            className="[font-family:var(--bento-mono)] font-bold text-[0.4em] lowercase pb-[0.15em]"
            style={{ color: NEON }}
          >
            {unit}
          </span>
        )}
      </div>
    </Tile>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md bg-[#0a0a0a] border border-[#1f1f1f] px-3 py-2">
      <div className="[font-family:var(--bento-mono)] text-[9px] font-bold uppercase tracking-[0.14em] text-[#6b6b6b] flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="font-bold text-sm tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
