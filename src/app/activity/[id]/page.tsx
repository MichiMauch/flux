import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activities, users, activityPhotos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Navbar } from "@/app/components/navbar";
import { RouteAnalysis } from "@/app/components/route-analysis";
import { ActivitySummary } from "@/app/components/activity-summary";
import { SplitsTable } from "@/app/components/splits-table";
import { PhotoLightbox } from "@/app/components/photo-lightbox";
import { fetchHistoricalWeather, type WeatherData } from "@/lib/weather";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function ActivityDetailPage({
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

  const photosRaw = await db
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

  const isOwner = activity.userId === session.user.id;
  const photoMarkers = photosRaw
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({ id: p.id, lat: p.lat as number, lng: p.lng as number }));

  const routeData = (activity.routeData as any[]) || [];
  const heartRateData = (activity.heartRateData as any[]) || [];
  const speedData = (activity.speedData as any[]) || [];

  const isRunning = activity.type?.toUpperCase() === "RUNNING";

  let weather = activity.weather as WeatherData | null;
  if (!weather && routeData.length > 0) {
    const first = routeData[0];
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

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Link>

        <div className="space-y-0">
          <ActivitySummary
            activity={activity}
            userName={user.name}
            photos={photosRaw.map((p) => ({ id: p.id, location: p.location }))}
            weather={weather}
            isOwner={isOwner}
            heartRateData={heartRateData}
            userProfile={{
              sex: user.sex as "male" | "female" | null,
              birthday: user.birthday,
              maxHeartRate: user.maxHeartRate,
              restHeartRate: user.restHeartRate,
              aerobicThreshold: user.aerobicThreshold,
              anaerobicThreshold: user.anaerobicThreshold,
            }}
          />

          {routeData.length > 0 && (
            <div className="-mt-px">
              <RouteAnalysis
                routeData={routeData}
                heartRateData={heartRateData}
                speedData={speedData}
                totalDistance={activity.distance}
                totalAscent={activity.ascent}
                totalDescent={activity.descent}
                isRunning={isRunning}
                photos={photoMarkers}
                startTime={activity.startTime}
                duration={activity.duration}
              />
            </div>
          )}
        </div>

        {routeData.length > 0 && (
          <SplitsTable
            routeData={routeData}
            heartRateData={heartRateData}
            isRunning={isRunning}
            totalDistanceMeters={activity.distance}
            totalAscent={activity.ascent}
            totalDescent={activity.descent}
          />
        )}
      </main>
      {photosRaw.length > 0 && <PhotoLightbox photos={photosRaw} />}
    </>
  );
}
