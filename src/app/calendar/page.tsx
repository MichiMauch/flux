import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/app/components/navbar";
import { WeeklySummary } from "@/app/components/weekly-summary";
import { ActivityCalendar } from "@/app/components/activity-calendar";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import {
  monthRange,
  parseMonthParam,
  formatMonthParam,
  shiftMonth,
  dayKey,
} from "@/lib/activity-week";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_LABELS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const { year, month } = parseMonthParam(params.month);
  const { from, to } = monthRange(year, month);

  // Extend a bit to include overflow days in the grid (prev/next month shown weeks)
  const gridFrom = new Date(from);
  gridFrom.setDate(gridFrom.getDate() - 7);
  const gridTo = new Date(to);
  gridTo.setDate(gridTo.getDate() + 7);

  const rows = await db
    .select({
      id: activities.id,
      type: activities.type,
      name: activities.name,
      startTime: activities.startTime,
      distance: activities.distance,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, session.user.id),
        gte(activities.startTime, gridFrom),
        lt(activities.startTime, gridTo)
      )
    );

  // Group by day key
  const byDay: Record<
    string,
    { id: string; type: string; name: string; distanceKm: number | null }[]
  > = {};
  for (const r of rows) {
    const key = dayKey(r.startTime);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push({
      id: r.id,
      type: r.type,
      name: r.name,
      distanceKm: r.distance != null ? r.distance / 1000 : null,
    });
  }

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-[-0.025em]">Kalender</h1>
        </div>

        <WeeklySummary userId={session.user.id} />

        {/* Month navigator */}
        <div className="flex items-center justify-between">
          <Link
            href={`/calendar?month=${formatMonthParam(prev.year, prev.month)}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm font-medium hover:bg-surface"
          >
            <ChevronLeft className="h-4 w-4" />
            {MONTH_LABELS[prev.month]}
          </Link>
          <div className="text-center">
            <div className="text-lg font-bold tracking-[-0.02em]">
              {MONTH_LABELS[month]} {year}
            </div>
            {!isCurrentMonth && (
              <Link
                href="/calendar"
                className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand hover:underline"
              >
                Heute
              </Link>
            )}
          </div>
          <Link
            href={`/calendar?month=${formatMonthParam(next.year, next.month)}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm font-medium hover:bg-surface"
          >
            {MONTH_LABELS[next.month]}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <ActivityCalendar year={year} month={month} byDay={byDay} />
      </main>
    </>
  );
}
