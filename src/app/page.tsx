import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from "./components/navbar";
import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { Activity, Bike, Footprints, Clock, Ruler, Mountain } from "lucide-react";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function getActivityIcon(type: string) {
  switch (type.toUpperCase()) {
    case "CYCLING":
      return <Bike className="h-5 w-5" />;
    case "RUNNING":
      return <Footprints className="h-5 w-5" />;
    default:
      return <Activity className="h-5 w-5" />;
  }
}

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const allActivities = await db
    .select({
      id: activities.id,
      name: activities.name,
      type: activities.type,
      startTime: activities.startTime,
      duration: activities.duration,
      distance: activities.distance,
      ascent: activities.ascent,
      avgHeartRate: activities.avgHeartRate,
      userName: users.name,
    })
    .from(activities)
    .innerJoin(users, eq(activities.userId, users.id))
    .orderBy(desc(activities.startTime))
    .limit(20);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Aktivitäten</h1>
        </div>

        {allActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Activity className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">Noch keine Aktivitäten</p>
            <p className="text-sm mt-1">
              Verbinde deinen Polar-Account, um Aktivitäten zu synchronisieren.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {allActivities.map((a) => (
              <a
                key={a.id}
                href={`/activity/${a.id}`}
                className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  {getActivityIcon(a.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.userName}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {a.startTime.toLocaleDateString("de-CH", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {a.distance != null && (
                    <span className="flex items-center gap-1">
                      <Ruler className="h-3.5 w-3.5" />
                      {formatDistance(a.distance)}
                    </span>
                  )}
                  {a.duration != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(a.duration)}
                    </span>
                  )}
                  {a.ascent != null && a.ascent > 0 && (
                    <span className="flex items-center gap-1">
                      <Mountain className="h-3.5 w-3.5" />
                      {Math.round(a.ascent)} m
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
