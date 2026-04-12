import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Navbar } from "@/app/components/navbar";
import { MapSection } from "@/app/components/map-section";
import { HeartRateChart } from "@/app/components/heart-rate-chart";
import { SpeedChart } from "@/app/components/speed-chart";
import { ElevationChart } from "@/app/components/elevation-chart";
import {
  ArrowLeft,
  Clock,
  Ruler,
  Mountain,
  Heart,
  Flame,
  Thermometer,
  Bike,
  Footprints,
  Activity,
} from "lucide-react";
import Link from "next/link";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min ${s}s`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

function formatPace(meters: number, seconds: number): string {
  if (!meters || !seconds) return "–";
  const paceSeconds = seconds / (meters / 1000);
  const m = Math.floor(paceSeconds / 60);
  const s = Math.round(paceSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")} min/km`;
}

function formatSpeed(meters: number, seconds: number): string {
  if (!meters || !seconds) return "–";
  return `${((meters / 1000) / (seconds / 3600)).toFixed(1)} km/h`;
}

function getActivityIcon(type: string) {
  switch (type.toUpperCase()) {
    case "CYCLING":
      return <Bike className="h-6 w-6" />;
    case "RUNNING":
      return <Footprints className="h-6 w-6" />;
    default:
      return <Activity className="h-6 w-6" />;
  }
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function MacroBar({ label, percentage, color }: { label: string; percentage: number; color: string }) {
  return (
    <div className="flex-1">
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

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

  const routeData = (activity.routeData as any[]) || [];
  const heartRateData = (activity.heartRateData as any[]) || [];
  const speedData = (activity.speedData as any[]) || [];

  const isRunning = activity.type?.toUpperCase() === "RUNNING";

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              {getActivityIcon(activity.type)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{activity.name}</h1>
              <p className="text-sm text-muted-foreground">
                {user.name} ·{" "}
                {activity.startTime.toLocaleDateString("de-CH", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                um{" "}
                {activity.startTime.toLocaleTimeString("de-CH", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {activity.distance != null && (
            <StatCard
              icon={<Ruler className="h-4 w-4" />}
              label="Distanz"
              value={formatDistance(activity.distance)}
            />
          )}
          {activity.duration != null && (
            <StatCard
              icon={<Clock className="h-4 w-4" />}
              label="Dauer"
              value={formatDuration(activity.duration)}
            />
          )}
          {activity.distance != null && activity.duration != null && (
            <StatCard
              icon={isRunning ? <Footprints className="h-4 w-4" /> : <Bike className="h-4 w-4" />}
              label={isRunning ? "Pace" : "Ø Geschwindigkeit"}
              value={isRunning
                ? formatPace(activity.distance, activity.duration)
                : formatSpeed(activity.distance, activity.duration)
              }
            />
          )}
          {activity.avgHeartRate != null && (
            <StatCard
              icon={<Heart className="h-4 w-4" />}
              label="Ø Puls"
              value={`${activity.avgHeartRate} bpm`}
            />
          )}
          {activity.maxHeartRate != null && (
            <StatCard
              icon={<Heart className="h-4 w-4" />}
              label="Max Puls"
              value={`${activity.maxHeartRate} bpm`}
            />
          )}
          {activity.ascent != null && activity.ascent > 0 && (
            <StatCard
              icon={<Mountain className="h-4 w-4" />}
              label="Aufstieg"
              value={`${Math.round(activity.ascent)} m`}
            />
          )}
          {activity.descent != null && activity.descent > 0 && (
            <StatCard
              icon={<Mountain className="h-4 w-4 rotate-180" />}
              label="Abstieg"
              value={`${Math.round(activity.descent)} m`}
            />
          )}
          {activity.calories != null && (
            <StatCard
              icon={<Flame className="h-4 w-4" />}
              label="Kalorien"
              value={`${activity.calories} kcal`}
            />
          )}
          {activity.totalSteps != null && activity.totalSteps > 0 && (
            <StatCard
              icon={<Footprints className="h-4 w-4" />}
              label="Schritte"
              value={`${activity.totalSteps.toLocaleString("de-CH")}`}
            />
          )}
          {activity.avgCadence != null && (
            <StatCard
              icon={<Activity className="h-4 w-4" />}
              label="Ø Kadenz"
              value={`${activity.avgCadence} spm`}
            />
          )}
          {activity.avgSpeed != null && (
            <StatCard
              icon={<Ruler className="h-4 w-4" />}
              label="Ø Speed (FIT)"
              value={`${activity.avgSpeed.toFixed(1)} km/h`}
            />
          )}
          {activity.cardioLoad != null && activity.cardioLoad > 0 && (
            <StatCard
              icon={<Activity className="h-4 w-4" />}
              label="Cardio Load"
              value={`${activity.cardioLoad.toFixed(1)}`}
            />
          )}
        </div>

        {/* Macros */}
        {activity.fatPercentage != null && (
          <div className="mb-6">
            <h2 className="font-semibold mb-3">Energieverbrauch</h2>
            <div className="rounded-lg border p-4">
              <div className="flex gap-6 items-center">
                <MacroBar label="Fett" percentage={activity.fatPercentage} color="#f59e0b" />
                <MacroBar label="Kohlenhydrate" percentage={activity.carbPercentage ?? 0} color="#3b82f6" />
                <MacroBar label="Eiweiss" percentage={activity.proteinPercentage ?? 0} color="#22c55e" />
              </div>
            </div>
          </div>
        )}

        {/* Device */}
        {activity.device && (
          <p className="text-xs text-muted-foreground mb-4">
            Aufgezeichnet mit {activity.device}
          </p>
        )}

        {/* Map */}
        {routeData.length > 0 && (
          <div className="mb-6">
            <h2 className="font-semibold mb-3">Strecke</h2>
            <div className="rounded-lg border overflow-hidden" style={{ height: 400 }}>
              <MapSection routeData={routeData} />
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-1">
          {heartRateData.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3">Herzfrequenz</h2>
              <div className="rounded-lg border p-4" style={{ height: 250 }}>
                <HeartRateChart data={heartRateData} />
              </div>
            </div>
          )}

          {speedData.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3">
                {isRunning ? "Pace" : "Geschwindigkeit"}
              </h2>
              <div className="rounded-lg border p-4" style={{ height: 250 }}>
                <SpeedChart data={speedData} isRunning={isRunning} />
              </div>
            </div>
          )}

          {routeData.length > 0 && routeData[0]?.elevation != null && (
            <div>
              <h2 className="font-semibold mb-3">Höhenprofil</h2>
              <div className="rounded-lg border p-4" style={{ height: 250 }}>
                <ElevationChart data={routeData} />
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
