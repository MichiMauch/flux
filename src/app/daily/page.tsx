import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { dailyActivity } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { DailyActivityView } from "@/app/components/daily-activity-view";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

function parseDateParam(v: string | undefined): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatLongDate(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  return d.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const requestedDate = parseDateParam(params.date);

  // If no date given, pick latest synced day
  let date = requestedDate;
  if (!date) {
    const latest = await db
      .select({ date: dailyActivity.date })
      .from(dailyActivity)
      .where(eq(dailyActivity.userId, session.user.id))
      .orderBy(desc(dailyActivity.date))
      .limit(1);
    date = latest[0]?.date ?? new Date().toISOString().slice(0, 10);
  }

  const row = await db.query.dailyActivity.findFirst({
    where: and(
      eq(dailyActivity.userId, session.user.id),
      eq(dailyActivity.date, date)
    ),
  });

  const today = new Date().toISOString().slice(0, 10);
  const prevDate = shiftDate(date, -1);
  const nextDate = shiftDate(date, 1);
  const isToday = date === today;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-[-0.025em]">Tagesaktivität</h1>
        </div>

        {/* Date navigator */}
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/daily?date=${prevDate}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm font-medium hover:bg-surface"
          >
            <ChevronLeft className="h-4 w-4" />
            {formatLongDate(prevDate).split(",")[0]}
          </Link>
          <div className="text-center">
            <div className="text-sm font-bold">{formatLongDate(date)}</div>
            {!isToday && (
              <Link
                href="/daily"
                className="text-[10px] font-semibold uppercase tracking-[0.1em] text-brand hover:underline"
              >
                Heute
              </Link>
            )}
          </div>
          <Link
            href={`/daily?date=${nextDate}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm font-medium hover:bg-surface"
          >
            {formatLongDate(nextDate).split(",")[0]}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {row ? (
          <DailyActivityView data={row} />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            <p className="font-semibold">Keine Daten für diesen Tag.</p>
            <p className="text-sm mt-1">
              Synchronisiere die Tagesaktivität auf <code>/</code> oder warte
              auf den nächsten Polar-Push.
            </p>
          </div>
        )}
    </main>
  );
}
