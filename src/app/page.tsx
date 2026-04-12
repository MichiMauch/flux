import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from "./components/navbar";
import { SyncButton } from "./components/sync-button";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import {
  Activity,
  Bike,
  Footprints,
  Clock,
  Ruler,
  Mountain,
  Heart,
  MountainSnow,
} from "lucide-react";
import Link from "next/link";

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
    case "HIKING":
      return <MountainSnow className="h-5 w-5" />;
    default:
      return <Activity className="h-5 w-5" />;
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const typeFilter = params.type;

  const conditions = [eq(activities.userId, session.user.id)];
  if (typeFilter) {
    conditions.push(eq(activities.type, typeFilter));
  }

  const myActivities = await db
    .select()
    .from(activities)
    .where(and(...conditions))
    .orderBy(desc(activities.startTime))
    .limit(50);

  // Get unique types for filter
  const allTypes = await db
    .selectDistinct({ type: activities.type })
    .from(activities)
    .where(eq(activities.userId, session.user.id));

  const types = allTypes.map((t) => t.type);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Meine Aktivitäten</h1>
          <SyncButton />
        </div>

        {/* Type Filter */}
        {types.length > 1 && (
          <div className="flex gap-2 mb-4">
            <Link
              href="/"
              className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                !typeFilter
                  ? "bg-foreground text-background"
                  : "hover:bg-muted"
              }`}
            >
              Alle
            </Link>
            {types.map((t) => (
              <Link
                key={t}
                href={`/?type=${t}`}
                className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                  typeFilter === t
                    ? "bg-foreground text-background"
                    : "hover:bg-muted"
                }`}
              >
                {t}
              </Link>
            ))}
          </div>
        )}

        {myActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Activity className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">Noch keine Aktivitäten</p>
            <p className="text-sm mt-1">
              Verbinde deinen Polar-Account, um Aktivitäten zu synchronisieren.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {myActivities.map((a) => (
              <Link
                key={a.id}
                href={`/activity/${a.id}`}
                className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  {getActivityIcon(a.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{a.name}</div>
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
                  {a.duration != null && a.duration > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(a.duration)}
                    </span>
                  )}
                  {a.avgHeartRate != null && (
                    <span className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" />
                      {a.avgHeartRate}
                    </span>
                  )}
                  {a.ascent != null && a.ascent > 0 && (
                    <span className="flex items-center gap-1">
                      <Mountain className="h-3.5 w-3.5" />
                      {Math.round(a.ascent)} m
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
