import { auth } from "@/auth";
import { redirect } from "next/navigation";
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
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { BentoTile } from "../components/bento/bento-tile";
import { rajdhani, spaceMono } from "../components/bento/bento-fonts";

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
    <BentoPageShell>
      <BentoPageHeader section="Kalender" title="Kalender" />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:auto-rows-min md:[grid-auto-flow:row_dense]">
        <div className="md:col-span-6">
          <BentoTile label="Woche" title="Aktuelle Woche">
            <WeeklySummary userId={session.user.id} />
          </BentoTile>
        </div>

        <div className="md:col-span-6">
          <BentoTile
            label="Monat"
            title={`${MONTH_LABELS[month]} ${year}`}
            right={
              <div className="flex items-center gap-2">
                <Link
                  href={`/calendar?month=${formatMonthParam(prev.year, prev.month)}`}
                  className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9ca3af] hover:text-white hover:border-[#4a4a4a] transition-colors`}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {MONTH_LABELS[prev.month]}
                </Link>
                {!isCurrentMonth && (
                  <Link
                    href="/calendar"
                    className={`${spaceMono.className} inline-flex items-center rounded-md border border-[#FF6A00]/40 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF6A00] hover:bg-[#FF6A00]/10 transition-colors`}
                  >
                    Heute
                  </Link>
                )}
                <Link
                  href={`/calendar?month=${formatMonthParam(next.year, next.month)}`}
                  className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9ca3af] hover:text-white hover:border-[#4a4a4a] transition-colors`}
                >
                  {MONTH_LABELS[next.month]}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            }
          >
            <div className={rajdhani.className}>
              <ActivityCalendar year={year} month={month} byDay={byDay} />
            </div>
          </BentoTile>
        </div>
      </div>
    </BentoPageShell>
  );
}
