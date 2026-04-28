import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activities, users, activityPhotos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeHrZones } from "@/lib/hr-zones";
import { fetchHistoricalWeather, type WeatherData } from "@/lib/weather";
import { BentoSplitsTable } from "@/app/components/bento/bento-splits-table";
import { PhotoLightbox } from "@/app/components/photo-lightbox";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { spaceMono } from "@/app/components/bento/bento-fonts";
import { activityTypeColor } from "@/lib/activity-types";
import type { HrSample, RoutePoint } from "@/lib/splits";
import { dimColor, km } from "./helpers";
import { ActivityDetailBody } from "./activity-detail-body";
import { ActivityDetailHero } from "./activity-detail-hero";
import { ActivityListRow } from "@/app/activities/activity-list-row";

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
  const totalSteps = activity.totalSteps;
  const trimp = activity.trimp;
  const avgSpeed = activity.avgSpeed;

  const dateLabel = activity.startTime
    .toLocaleDateString("de-CH", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/\s(\d{4})$/, "\u00a0$1");

  const color = activityTypeColor(activity.type);
  const colorDim = dimColor(color);

  return (
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
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1 [font-family:var(--bento-mono)] text-xs text-[#a3a3a3] hover:text-white uppercase tracking-[0.16em] font-bold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück
          </Link>
          <Link
            href={`/activity/${id}/classic`}
            className="[font-family:var(--bento-mono)] text-[10px] uppercase tracking-[0.16em] text-[#a3a3a3] hover:text-white"
          >
            Klassische Ansicht
          </Link>
        </div>

        <ActivityListRow
          asStatic
          id={activity.id}
          name={activity.name}
          type={activity.type}
          startTime={activity.startTime}
          distance={activity.distance}
          duration={activity.duration}
          movingTime={activity.movingTime}
          avgHeartRate={activity.avgHeartRate}
          ascent={activity.ascent}
          routeData={activity.routeData}
          photoCount={photos.length}
        />

        <ActivityDetailHero
          dateLabel={dateLabel}
          name={activity.name}
          isOwner={isOwner}
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
          distanceKm={distanceKm}
          ascent={ascent}
          calories={calories}
        />

        <ActivityDetailBody
          activityId={activity.id}
          distance={activity.distance}
          ascent={ascent}
          descent={descent}
          avgHr={avgHr}
          maxHr={maxHr}
          totalSteps={totalSteps}
          trimp={trimp}
          avgSpeed={avgSpeed}
          duration={duration}
          isRunning={isRunning}
          color={color}
          route={route}
          hr={hr}
          hrZones={hrZones ? hrZones.zones : null}
          weather={weather}
          notes={activity.notes}
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
  );
}
