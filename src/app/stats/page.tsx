import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { WeeklyChart } from "../components/weekly-chart";
import { MonthlyChart } from "../components/monthly-chart";
import { Ruler, Clock, Mountain, Flame, Activity } from "lucide-react";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { BentoTile } from "../components/bento/bento-tile";
import { rajdhani, spaceMono } from "../components/bento/bento-fonts";

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

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearFilter = and(
    eq(activities.userId, userId),
    gte(activities.startTime, yearStart)
  );
  const yearTotals = await db
    .select({
      count: sql<number>`count(*)`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
      totalAscent: sql<number>`coalesce(sum(${activities.ascent}), 0)`,
      totalCalories: sql<number>`coalesce(sum(${activities.calories}), 0)`,
    })
    .from(activities)
    .where(yearFilter);

  const year = yearTotals[0];

  const byType = await db
    .select({
      type: activities.type,
      count: sql<number>`count(*)`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
    })
    .from(activities)
    .where(yearFilter)
    .groupBy(activities.type)
    .orderBy(desc(sql`sum(${activities.distance})`));

  const weeklyData = await db
    .select({
      week: sql<string>`to_char(${activities.startTime}, 'IYYY-IW')`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(activities)
    .where(and(
      eq(activities.userId, userId),
      gte(activities.startTime, new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000))
    ))
    .groupBy(sql`to_char(${activities.startTime}, 'IYYY-IW')`)
    .orderBy(sql`to_char(${activities.startTime}, 'IYYY-IW')`);

  const monthlyData = await db
    .select({
      month: sql<string>`to_char(${activities.startTime}, 'YYYY-MM')`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
      totalAscent: sql<number>`coalesce(sum(${activities.ascent}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(activities)
    .where(and(
      eq(activities.userId, userId),
      gte(activities.startTime, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))
    ))
    .groupBy(sql`to_char(${activities.startTime}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${activities.startTime}, 'YYYY-MM')`);

  const currentYear = new Date().getFullYear();

  type Metric = {
    icon: typeof Activity;
    label: string;
    value: string;
  };
  const metrics: Metric[] = [
    { icon: Activity, label: "Aktivitäten", value: `${year.count}` },
    { icon: Ruler, label: "Distanz", value: formatDistance(year.totalDistance) },
    { icon: Clock, label: "Dauer", value: formatDuration(year.totalDuration) },
    {
      icon: Mountain,
      label: "Höhenmeter",
      value: `${Math.round(year.totalAscent).toLocaleString("de-CH")} m`,
    },
    {
      icon: Flame,
      label: "kcal",
      value: Math.round(year.totalCalories).toLocaleString("de-CH"),
    },
  ];

  return (
    <BentoPageShell>
      <BentoPageHeader section="Stats" title="Statistiken" />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:auto-rows-min md:[grid-auto-flow:row_dense]">
        <div className="md:col-span-6">
          <BentoTile label={`Jahresbilanz · ${currentYear}`} title="Gesamt">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {metrics.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.label}
                    className="rounded-lg border border-[#2a2a2a] bg-black/40 p-3 text-center"
                  >
                    <Icon className="mx-auto mb-1 h-4 w-4 text-[#a3a3a3]" />
                    <div
                      className={`${rajdhani.className} text-2xl font-bold leading-none text-white`}
                    >
                      {m.value}
                    </div>
                    <div
                      className={`${spaceMono.className} mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3]`}
                    >
                      {m.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {byType.length > 1 && (
              <div className="mt-4 border-t border-[#2a2a2a] pt-4">
                <div
                  className={`${spaceMono.className} mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3a3a3]`}
                >
                  Nach Sportart
                </div>
                <div className="grid gap-1.5">
                  {byType.map((t) => (
                    <div
                      key={t.type}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-semibold text-white">{t.type}</span>
                      <span
                        className={`${spaceMono.className} text-[11px] text-[#9ca3af]`}
                      >
                        {t.count}× · {formatDistance(t.totalDistance)} ·{" "}
                        {formatDuration(t.totalDuration)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </BentoTile>
        </div>

        <div className="md:col-span-3">
          <BentoTile label="Wochen" title="Letzte 12 Wochen">
            <div style={{ height: 260 }}>
              <WeeklyChart
                data={weeklyData.map((w) => ({
                  week: "KW " + w.week.split("-")[1],
                  distance: Math.round(w.totalDistance / 1000),
                  duration: Math.round(w.totalDuration / 60),
                  count: w.count,
                }))}
              />
            </div>
          </BentoTile>
        </div>

        <div className="md:col-span-3">
          <BentoTile label="Monate" title="Letzte 12 Monate">
            <div style={{ height: 260 }}>
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
          </BentoTile>
        </div>
      </div>
    </BentoPageShell>
  );
}
