import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from "../components/navbar";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { WeeklyChart } from "../components/weekly-chart";
import { MonthlyChart } from "../components/monthly-chart";
import { Ruler, Clock, Mountain, Flame, Activity } from "lucide-react";

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(0)} km`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}min`;
}

export default async function StatsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = session.user.id;

  // Year totals
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearTotals = await db
    .select({
      count: sql<number>`count(*)`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
      totalAscent: sql<number>`coalesce(sum(${activities.ascent}), 0)`,
      totalCalories: sql<number>`coalesce(sum(${activities.calories}), 0)`,
    })
    .from(activities)
    .where(
      sql`${activities.userId} = ${userId} AND ${activities.startTime} >= ${yearStart}`
    );

  const year = yearTotals[0];

  // By type this year
  const byType = await db
    .select({
      type: activities.type,
      count: sql<number>`count(*)`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
    })
    .from(activities)
    .where(
      sql`${activities.userId} = ${userId} AND ${activities.startTime} >= ${yearStart}`
    )
    .groupBy(activities.type)
    .orderBy(desc(sql`sum(${activities.distance})`));

  // Weekly data (last 12 weeks)
  const weeklyData = await db
    .select({
      week: sql<string>`to_char(${activities.startTime}, 'IYYY-IW')`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(activities)
    .where(
      sql`${activities.userId} = ${userId} AND ${activities.startTime} >= now() - interval '12 weeks'`
    )
    .groupBy(sql`to_char(${activities.startTime}, 'IYYY-IW')`)
    .orderBy(sql`to_char(${activities.startTime}, 'IYYY-IW')`);

  // Monthly data (last 12 months)
  const monthlyData = await db
    .select({
      month: sql<string>`to_char(${activities.startTime}, 'YYYY-MM')`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
      totalAscent: sql<number>`coalesce(sum(${activities.ascent}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(activities)
    .where(
      sql`${activities.userId} = ${userId} AND ${activities.startTime} >= now() - interval '12 months'`
    )
    .groupBy(sql`to_char(${activities.startTime}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${activities.startTime}, 'YYYY-MM')`);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Statistiken</h1>

        {/* Year Summary */}
        <div className="rounded-lg border p-6 mb-6">
          <h2 className="font-semibold mb-4">{new Date().getFullYear()}</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Activity className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold">{year.count}</div>
              <div className="text-xs text-muted-foreground">Aktivitäten</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Ruler className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold">
                {formatDistance(year.totalDistance)}
              </div>
              <div className="text-xs text-muted-foreground">Distanz</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold">
                {formatDuration(year.totalDuration)}
              </div>
              <div className="text-xs text-muted-foreground">Dauer</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Mountain className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold">
                {Math.round(year.totalAscent).toLocaleString("de-CH")} m
              </div>
              <div className="text-xs text-muted-foreground">Höhenmeter</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Flame className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold">
                {Math.round(year.totalCalories).toLocaleString("de-CH")}
              </div>
              <div className="text-xs text-muted-foreground">kcal</div>
            </div>
          </div>

          {/* By type */}
          {byType.length > 1 && (
            <div className="mt-6 pt-4 border-t">
              <div className="grid gap-2">
                {byType.map((t) => (
                  <div
                    key={t.type}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">{t.type}</span>
                    <span className="text-muted-foreground">
                      {t.count}× · {formatDistance(t.totalDistance)} ·{" "}
                      {formatDuration(t.totalDuration)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Weekly Chart */}
        <div className="rounded-lg border p-6 mb-6">
          <h2 className="font-semibold mb-4">Wochenübersicht (12 Wochen)</h2>
          <div style={{ height: 250 }}>
            <WeeklyChart
              data={weeklyData.map((w) => ({
                week: "KW " + w.week.split("-")[1],
                distance: Math.round(w.totalDistance / 1000),
                duration: Math.round(w.totalDuration / 60),
                count: w.count,
              }))}
            />
          </div>
        </div>

        {/* Monthly Chart */}
        <div className="rounded-lg border p-6 mb-6">
          <h2 className="font-semibold mb-4">Monatsübersicht (12 Monate)</h2>
          <div style={{ height: 250 }}>
            <MonthlyChart
              data={monthlyData.map((m) => {
                const [y, mo] = m.month.split("-");
                const monthNames = [
                  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
                  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
                ];
                return {
                  month: monthNames[parseInt(mo) - 1] + " " + y.slice(2),
                  distance: Math.round(m.totalDistance / 1000),
                  ascent: Math.round(m.totalAscent),
                  count: m.count,
                };
              })}
            />
          </div>
        </div>
      </main>
    </>
  );
}
