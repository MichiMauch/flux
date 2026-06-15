import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  activities,
  users,
  activityPhotos,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeHrZones } from "@/lib/hr-zones";
import { fetchHistoricalWeather, type WeatherData } from "@/lib/weather";
import { BentoSplitsTable } from "@/app/components/bento/bento-splits-table";
import { PhotoLightbox } from "@/app/components/photo-lightbox";
import { spaceMono } from "@/app/components/bento/bento-fonts";
import { activityTypeColor } from "@/lib/activity-types";
import type { HrSample, RoutePoint } from "@/lib/splits";
import { dimColor, km } from "@/app/activity/[id]/helpers";
import { ActivityDetailBody } from "@/app/activity/[id]/activity-detail-body";
import { ActivityDetailHero } from "@/app/activity/[id]/activity-detail-hero";
import { ShareTokenProvider } from "@/lib/share-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Geteilte Aktivität",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SharedActivityPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const result = await db
    .select()
    .from(activities)
    .innerJoin(users, eq(activities.userId, users.id))
    .where(eq(activities.shareToken, token))
    .limit(1);
  if (result.length === 0) notFound();
  const activity = result[0].activities;
  const owner = result[0].user;

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

  const hr = (activity.heartRateData as HrSample[] | null) ?? [];
  const hrZones = computeHrZones(hr, {
    sex: owner.sex as "male" | "female" | null,
    birthday: owner.birthday,
    maxHeartRate: owner.maxHeartRate,
    restHeartRate: owner.restHeartRate,
    aerobicThreshold: owner.aerobicThreshold,
    anaerobicThreshold: owner.anaerobicThreshold,
  });

  const duration = activity.movingTime ?? activity.duration ?? 0;
  const totalDuration =
    activity.duration != null && activity.duration > duration
      ? activity.duration
      : null;
  const distanceKm = km(activity.distance);
  const ascent = activity.ascent != null ? Math.round(activity.ascent) : null;
  const descent = activity.descent != null ? Math.round(activity.descent) : null;

  const dateLabel = activity.startTime
    .toLocaleDateString("de-CH", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/\s(\d{4})$/, " $1");

  const color = activityTypeColor(activity.type);
  const colorDim = dimColor(color);

  return (
    <ShareTokenProvider token={token}>
      <div
        className="dark min-h-screen bg-black text-white"
        style={{
          fontFeatureSettings: '"ss01", "cv11"',
          ["--bento-mono" as string]: spaceMono.style.fontFamily,
          ["--activity-color" as string]: color,
          ["--activity-color-dim" as string]: colorDim,
        }}
      >
        <main className="mx-auto w-full max-w-7xl px-4 py-6 space-y-3">
          <div
            className={`${spaceMono.className} inline-flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]`}
          >
            Von <span className="text-white">{owner.name ?? "User"}</span> geteilt · Flux
          </div>

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
            photoIds={photos.map((p) => ({ id: p.id }))}
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
            distance={activity.distance}
            ascent={ascent}
            descent={descent}
            avgHr={activity.avgHeartRate}
            maxHr={activity.maxHeartRate}
            totalSteps={activity.totalSteps}
            trimp={activity.trimp}
            avgSpeed={activity.avgSpeed}
            duration={duration}
            isRunning={isRunning}
            color={color}
            route={route}
            hr={hr}
            hrZones={hrZones ? hrZones.zones : null}
            weather={weather}
            notes={activity.notes}
            isOwner={false}
            photos={photos}
          />

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
    </ShareTokenProvider>
  );
}
