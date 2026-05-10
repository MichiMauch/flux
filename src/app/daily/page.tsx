import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { dailyActivity, dailyPolarExtras } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { DailyActivityView } from "@/app/components/daily-activity-view";
import { DailyPolarExtrasView } from "@/app/components/daily-polar-extras-view";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { BentoTile } from "../components/bento/bento-tile";
import { spaceMono } from "../components/bento/bento-fonts";

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

  const [row, extras] = await Promise.all([
    db.query.dailyActivity.findFirst({
      where: and(
        eq(dailyActivity.userId, session.user.id),
        eq(dailyActivity.date, date),
      ),
    }),
    db.query.dailyPolarExtras.findFirst({
      where: and(
        eq(dailyPolarExtras.userId, session.user.id),
        eq(dailyPolarExtras.date, date),
      ),
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const prevDate = shiftDate(date, -1);
  const nextDate = shiftDate(date, 1);
  const isToday = date === today;

  return (
    <BentoPageShell>
      <BentoPageHeader section="Tag" title="Tagesaktivität" />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:auto-rows-min md:[grid-auto-flow:row_dense]">
        <div className="md:col-span-6">
          <BentoTile
            label="Datum"
            title={formatLongDate(date)}
            right={
              <div className="flex items-center gap-2">
                <Link
                  href={`/daily?date=${prevDate}`}
                  className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9ca3af] hover:text-white hover:border-[#4a4a4a] transition-colors`}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {formatLongDate(prevDate).split(",")[0]}
                </Link>
                {!isToday && (
                  <Link
                    href="/daily"
                    className={`${spaceMono.className} inline-flex items-center rounded-md border border-[#FF6A00]/40 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF6A00] hover:bg-[#FF6A00]/10 transition-colors`}
                  >
                    Heute
                  </Link>
                )}
                <Link
                  href={`/daily?date=${nextDate}`}
                  className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9ca3af] hover:text-white hover:border-[#4a4a4a] transition-colors`}
                >
                  {formatLongDate(nextDate).split(",")[0]}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            }
          >
            {row ? (
              <div className="space-y-4">
                <DailyActivityView data={row} />
                {extras && <DailyPolarExtrasView data={extras} />}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-black/40 p-10 text-center">
                <p className="font-semibold text-white">Keine Daten für diesen Tag.</p>
                <p className="mt-1 text-sm text-[#9ca3af]">
                  Synchronisiere die Tagesaktivität auf <code>/</code> oder warte
                  auf den nächsten Polar-Push.
                </p>
              </div>
            )}
          </BentoTile>
        </div>
      </div>
    </BentoPageShell>
  );
}
