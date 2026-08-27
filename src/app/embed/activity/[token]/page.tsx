import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Activity as ActivityIcon,
  Clock,
  Gauge,
  Heart,
  Mountain,
  Route as RouteIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeHrZones } from "@/lib/hr-zones";
import { type WeatherData } from "@/lib/weather";
import { spaceMono } from "@/app/components/bento/bento-fonts";
import { BentoRouteInteractive } from "@/app/components/bento/bento-route-interactive";
import { BentoSplitsTable } from "@/app/components/bento/bento-splits-table";
import { StatTile } from "@/app/activity/[id]/tiles";
import { dimColor, km } from "@/app/activity/[id]/helpers";
import { ActivityDetailBody } from "@/app/activity/[id]/activity-detail-body";
import { ActivityDetailHero } from "@/app/activity/[id]/activity-detail-hero";
import {
  activityTypeColor,
  activityTypeLabel,
  showsTerrain,
} from "@/lib/activity-types";
import { avgSpeedKmh, APP_TIME_ZONE, formatDurationHMS } from "@/lib/activity-format";
import type { HrSample, RoutePoint } from "@/lib/splits";
import { EmbedAutoHeight } from "./embed-auto-height";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Variant = "card" | "map" | "full";

function getVariant(raw: string | string[] | undefined): Variant {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "map" || v === "full" ? v : "card";
}

export async function generateMetadata(): Promise<Metadata> {
  // Embeds are private widgets, never for search engines.
  return { robots: { index: false, follow: false } };
}

export default async function EmbeddedActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const variant = getVariant((await searchParams).variant);

  const result = await db
    .select()
    .from(activities)
    .innerJoin(users, eq(activities.userId, users.id))
    .where(eq(activities.shareToken, token))
    .limit(1);
  if (result.length === 0) notFound();
  const activity = result[0].activities;
  const owner = result[0].user;

  const route = (activity.routeData as RoutePoint[] | null) ?? [];
  const hr = (activity.heartRateData as HrSample[] | null) ?? [];
  const isRunning = activity.type?.toUpperCase() === "RUNNING";
  const color = activityTypeColor(activity.type);
  const colorDim = dimColor(color);

  const duration = activity.movingTime ?? activity.duration ?? 0;
  const distanceKm = km(activity.distance);
  const ascent = activity.ascent != null ? Math.round(activity.ascent) : null;
  const descent =
    activity.descent != null ? Math.round(activity.descent) : null;

  const dateLabel = activity.startTime
    .toLocaleDateString("de-CH", {
      timeZone: APP_TIME_ZONE,
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/\s(\d{4})$/, " $1");

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const shareUrl = `${base}/share/activity/${token}`;

  return (
    <div
      className="dark bg-black text-white"
      style={{
        fontFeatureSettings: '"ss01", "cv11"',
        ["--bento-mono" as string]: spaceMono.style.fontFamily,
        ["--activity-color" as string]: color,
        ["--activity-color-dim" as string]: colorDim,
      }}
    >
      {/* The global root layout forces html.h-full + body.min-h-full, which
          would make the measured document height equal the iframe viewport
          (never the content). Reset it so the widget can report its true
          content height to the embedding page. */}
      <style>{`html,body{height:auto!important;min-height:0!important}`}</style>
      <EmbedAutoHeight token={token} />

      {variant === "full" ? (
        <FullEmbed
          activity={activity}
          owner={owner}
          route={route}
          hr={hr}
          isRunning={isRunning}
          color={color}
          duration={duration}
          distanceKm={distanceKm}
          ascent={ascent}
          descent={descent}
          dateLabel={dateLabel}
          shareUrl={shareUrl}
        />
      ) : (
        <CompactEmbed
          withMap={variant === "map"}
          activity={activity}
          route={route}
          hr={hr}
          isRunning={isRunning}
          color={color}
          duration={duration}
          distanceKm={distanceKm}
          ascent={ascent}
          descent={descent}
          dateLabel={dateLabel}
          shareUrl={shareUrl}
        />
      )}
    </div>
  );
}

type CompactActivity = {
  name: string;
  type: string | null;
  distance: number | null;
  movingTime: number | null;
  duration: number | null;
  avgHeartRate: number | null;
};

function BrandFooter({ shareUrl }: { shareUrl: string }) {
  return (
    <a
      href={shareUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${spaceMono.className} flex items-center justify-between rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3] hover:border-[#3a3a3a] hover:text-white transition-colors`}
    >
      <span>Flux</span>
      <span className="text-white">Aktivität ansehen →</span>
    </a>
  );
}

function CompactEmbed({
  withMap,
  activity,
  route,
  hr,
  isRunning,
  color,
  duration,
  distanceKm,
  ascent,
  descent,
  dateLabel,
  shareUrl,
}: {
  withMap: boolean;
  activity: CompactActivity;
  route: RoutePoint[];
  hr: HrSample[];
  isRunning: boolean;
  color: string;
  duration: number;
  distanceKm: string;
  ascent: number | null;
  descent: number | null;
  dateLabel: string;
  shareUrl: string;
}) {
  const speed = avgSpeedKmh(
    activity.distance,
    activity.movingTime,
    activity.duration
  );
  const avgSpeedLabel = speed != null ? speed.toFixed(1) : null;
  // Yoga: weder Karte noch Aufstieg.
  const terrain = showsTerrain(activity.type);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 p-3">
      <div>
        <div
          className={`${spaceMono.className} text-[10px] uppercase tracking-[0.16em]`}
          style={{ color }}
        >
          {activityTypeLabel(activity.type ?? "")} · {dateLabel}
        </div>
        <h1 className="mt-1 text-lg font-semibold leading-tight text-white">
          {activity.name}
        </h1>
      </div>

      {terrain && withMap && route.length > 0 && (
        <BentoRouteInteractive
          routeData={route}
          heartRateData={hr}
          totalDistance={activity.distance}
          totalAscent={ascent}
          totalDescent={descent}
          isRunning={isRunning}
          color={color}
        />
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          icon={<RouteIcon />}
          label="Distanz"
          value={distanceKm}
          unit="km"
        />
        <StatTile
          icon={<Clock />}
          label="Zeit"
          value={formatDurationHMS(duration)}
        />
        {terrain && ascent != null && (
          <StatTile
            icon={<Mountain />}
            label="Aufstieg"
            value={ascent.toString()}
            unit="m"
          />
        )}
        {avgSpeedLabel != null ? (
          <StatTile
            icon={<Gauge />}
            label="Ø Tempo"
            value={avgSpeedLabel}
            unit="km/h"
          />
        ) : activity.avgHeartRate != null ? (
          <StatTile
            icon={<Heart />}
            label="Ø Puls"
            value={activity.avgHeartRate.toString()}
            unit="bpm"
          />
        ) : (
          <StatTile
            icon={<ActivityIcon />}
            label="Typ"
            value={activityTypeLabel(activity.type ?? "")}
          />
        )}
      </div>

      <BrandFooter shareUrl={shareUrl} />
    </div>
  );
}

function FullEmbed({
  activity,
  owner,
  route,
  hr,
  isRunning,
  color,
  duration,
  distanceKm,
  ascent,
  descent,
  dateLabel,
  shareUrl,
}: {
  activity: typeof activities.$inferSelect;
  owner: typeof users.$inferSelect;
  route: RoutePoint[];
  hr: HrSample[];
  isRunning: boolean;
  color: string;
  duration: number;
  distanceKm: string;
  ascent: number | null;
  descent: number | null;
  dateLabel: string;
  shareUrl: string;
}) {
  const totalDuration =
    activity.duration != null && activity.duration > duration
      ? activity.duration
      : null;

  const hrZones = computeHrZones(hr, {
    sex: owner.sex as "male" | "female" | null,
    birthday: owner.birthday,
    maxHeartRate: owner.maxHeartRate,
    restHeartRate: owner.restHeartRate,
    aerobicThreshold: owner.aerobicThreshold,
    anaerobicThreshold: owner.anaerobicThreshold,
  });

  const weather = activity.weather as WeatherData | null;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-3 p-3">
      <ActivityDetailHero
        dateLabel={dateLabel}
        name={activity.name}
        isOwner={false}
        activity={{
          id: activity.id,
          name: activity.name,
          type: activity.type,
          notes: activity.notes,
          ascent: activity.ascent,
          descent: activity.descent,
        }}
        photoIds={[]}
        duration={duration}
        totalDuration={totalDuration}
        distanceKm={distanceKm}
        ascent={ascent}
        calories={activity.calories}
        boostable={false}
        boostedByMe={false}
        boosters={[]}
        color={color}
        personalBests={[]}
      />

      <ActivityDetailBody
        activityId={activity.id}
        type={activity.type}
        distance={activity.distance}
        ascent={ascent}
        descent={descent}
        avgHr={activity.avgHeartRate}
        maxHr={activity.maxHeartRate}
        totalSteps={activity.totalSteps}
        trimp={activity.trimp}
        avgSpeed={avgSpeedKmh(
          activity.distance,
          activity.movingTime,
          activity.duration
        )}
        duration={duration}
        isRunning={isRunning}
        color={color}
        route={route}
        hr={hr}
        hrZones={hrZones ? hrZones.zones : null}
        weather={weather}
        notes={activity.notes}
        isOwner={false}
        photos={[]}
      />

      {showsTerrain(activity.type) && route.length > 0 && (
        <BentoSplitsTable
          routeData={route}
          heartRateData={hr}
          isRunning={isRunning}
          totalDistanceMeters={activity.distance}
          totalAscent={activity.ascent}
          totalDescent={activity.descent}
        />
      )}

      <BrandFooter shareUrl={shareUrl} />
    </main>
  );
}
