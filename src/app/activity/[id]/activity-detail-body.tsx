import {
  Activity as ActivityIcon,
  Footprints,
  Gauge,
  Heart,
  TrendingDown,
  Zap,
} from "lucide-react";
import { BentoElevationChart } from "@/app/components/bento/bento-elevation-chart";
import { BentoGpxTile } from "@/app/components/bento/bento-gpx-tile";
import { BentoNotesTile } from "@/app/components/bento/bento-notes-tile";
import { BentoPhotosTile } from "@/app/components/bento/bento-photos-tile";
import { BentoRouteInteractive } from "@/app/components/bento/bento-route-interactive";
import { BentoWeatherTile } from "@/app/components/bento/bento-weather-tile";
import { HoverProvider } from "@/app/components/bento/hover-context";
import type { WeatherData } from "@/lib/weather";
import type { HrSample, RoutePoint } from "@/lib/splits";
import type { HrZone } from "@/lib/hr-zones";
import { dotsForIntensity, dotsForTrimp, fmt } from "./helpers";
import { DotsTile, StatTile, Tile, TileLabel } from "./tiles";
import { HrZonesTile } from "./hr-zones-tile";

export interface ActivityDetailBodyProps {
  activityId: string;
  distance: number | null;
  ascent: number | null;
  descent: number | null;
  avgHr: number | null;
  maxHr: number | null;
  totalSteps: number | null;
  trimp: number | null;
  avgSpeed: number | null;
  duration: number;
  isRunning: boolean;
  color: string;
  route: RoutePoint[];
  hr: HrSample[];
  hrZones: HrZone[] | null;
  weather: WeatherData | null;
  notes: string | null;
  isOwner: boolean;
  photos: {
    id: string;
    lat: number | null;
    lng: number | null;
    takenAt: Date | null;
  }[];
}

export function ActivityDetailBody({
  activityId,
  distance,
  ascent,
  descent,
  avgHr,
  maxHr,
  totalSteps,
  trimp,
  avgSpeed,
  duration,
  isRunning,
  color,
  route,
  hr,
  hrZones,
  weather,
  notes,
  isOwner,
  photos,
}: ActivityDetailBodyProps) {
  return (
    <HoverProvider>
      <div className="grid gap-3 lg:grid-cols-2 items-start">
        <div className="flex flex-col gap-3">
          {route.length > 0 ? (
            <BentoRouteInteractive
              routeData={route}
              heartRateData={hr}
              totalDistance={distance}
              totalAscent={ascent}
              totalDescent={descent}
              isRunning={isRunning}
              color={color}
              photos={photos
                .filter((p) => p.lat != null && p.lng != null)
                .map((p) => ({
                  id: p.id,
                  lat: p.lat as number,
                  lng: p.lng as number,
                }))}
            />
          ) : (
            <Tile className="p-2 overflow-hidden">
              <div className="h-[560px] flex items-center justify-center text-[#555] text-xs uppercase tracking-[0.16em]">
                keine Route
              </div>
            </Tile>
          )}
          <BentoNotesTile notes={notes} />
          {(isOwner || photos.length > 0) && (
            <BentoPhotosTile
              activityId={activityId}
              photos={photos}
              isOwner={isOwner}
            />
          )}
          <BentoWeatherTile weather={weather} />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 h-[520px]">
            <Tile className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <TileLabel>Höhenprofil</TileLabel>
                <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]">
                  Aufstieg{" "}
                  <span className="text-white tabular-nums">
                    {ascent != null ? `${ascent} m` : "–"}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <BentoElevationChart route={route} />
              </div>
            </Tile>
            {hrZones && (
              <div className="flex-1 min-h-0">
                <HrZonesTile zones={hrZones} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatTile icon={<Heart />} label="Ø Puls" value={fmt(avgHr)} unit="bpm" />
            <StatTile icon={<Heart />} label="Max Puls" value={fmt(maxHr)} unit="bpm" />
            <StatTile
              icon={<TrendingDown />}
              label="Abstieg"
              value={fmt(descent)}
              unit="m"
            />
            <DotsTile
              icon={<Zap />}
              label="TRIMP"
              count={trimp != null ? dotsForTrimp(trimp) : 0}
            />
            <DotsTile
              icon={<Gauge />}
              label="Intensität /h"
              count={
                trimp != null && duration > 0
                  ? dotsForIntensity(trimp / (duration / 3600))
                  : 0
              }
            />
            <StatTile
              icon={<ActivityIcon />}
              label="Ø Tempo"
              value={fmt(avgSpeed != null ? avgSpeed * 3.6 : null, 1)}
              unit="km/h"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {totalSteps != null && totalSteps > 0 && (
              <StatTile
                icon={<Footprints />}
                label="Schritte"
                value={fmt(totalSteps)}
              />
            )}
            {route.length > 0 && <BentoGpxTile activityId={activityId} />}
          </div>
        </div>
      </div>
    </HoverProvider>
  );
}
