import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sleepSessions, nightlyRecharge } from "@/lib/db/schema";
import { and, eq, desc, gte } from "drizzle-orm";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { BentoTile } from "../components/bento/bento-tile";
import { spaceMono } from "../components/bento/bento-fonts";
import { LedValue } from "../components/bento/led-value";
import { SleepHypnogram } from "../components/sleep-hypnogram";
import { SleepHrChart } from "../components/sleep-hr-chart";
import { SleepHistoryChart } from "../components/sleep-history-chart";

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

function formatNight(date: string): string {
  const end = new Date(date + "T00:00:00Z");
  const start = new Date(end.getTime() - 86400_000);
  const wdStart = start.toLocaleDateString("de-CH", {
    weekday: "long",
    timeZone: "UTC",
  });
  const wdEnd = end.toLocaleDateString("de-CH", {
    weekday: "long",
    timeZone: "UTC",
  });
  const day = end.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${wdStart} auf ${wdEnd}, ${day}`;
}

function fmtHours(sec: number | null | undefined): string {
  if (sec == null) return "–";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  // Format wie auf Aktivitäts-Detailseite: "5:07 h" / "30 min" — Unit wird
  // vom LedValue-Parser als txt-Token erkannt und orange gerendert.
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")} h`;
  return `${m} min`;
}

function fmtTime(d: Date | null | undefined): string {
  if (!d) return "–";
  return d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

function pct(part: number | null, total: number | null): string {
  if (!part || !total || total <= 0) return "–";
  return `${Math.round((part / total) * 100)}%`;
}

export default async function SleepPage({
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
      .select({ date: sleepSessions.date })
      .from(sleepSessions)
      .where(eq(sleepSessions.userId, session.user.id))
      .orderBy(desc(sleepSessions.date))
      .limit(1);
    date = latest[0]?.date ?? new Date().toISOString().slice(0, 10);
  }

  const sleep = await db.query.sleepSessions.findFirst({
    where: and(
      eq(sleepSessions.userId, session.user.id),
      eq(sleepSessions.date, date)
    ),
  });
  const night = await db.query.nightlyRecharge.findFirst({
    where: and(
      eq(nightlyRecharge.userId, session.user.id),
      eq(nightlyRecharge.date, date)
    ),
  });

  const cutoff = shiftDate(date, -13);
  const history = await db
    .select({
      date: sleepSessions.date,
      totalSleepSec: sleepSessions.totalSleepSec,
      sleepScore: sleepSessions.sleepScore,
    })
    .from(sleepSessions)
    .where(
      and(
        eq(sleepSessions.userId, session.user.id),
        gte(sleepSessions.date, cutoff)
      )
    )
    .orderBy(sleepSessions.date);

  const historyData = history.map((r) => ({
    date: r.date,
    hours: r.totalSleepSec ? r.totalSleepSec / 3600 : null,
    score: r.sleepScore,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const prevDate = shiftDate(date, -1);
  const nextDate = shiftDate(date, 1);
  const isToday = date === today;

  const total = sleep?.totalSleepSec ?? null;

  type Stat = { value: string; label: string };
  const metricBox = ({ value, label }: Stat) => (
    <div
      key={label}
      className="rounded-lg border border-[#2a2a2a] bg-black/40 p-3 text-center flex flex-col items-center gap-1.5"
    >
      <div style={{ fontSize: "22px" }}>
        <LedValue value={value} textColor="#FF6A00" />
      </div>
      <div
        className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3]`}
      >
        {label}
      </div>
    </div>
  );

  return (
    <BentoPageShell>
      <BentoPageHeader section="Schlaf" title="Schlaf" />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:auto-rows-min md:[grid-auto-flow:row_dense]">
        {/* Datum + Nav */}
        <div className="md:col-span-6">
          <BentoTile label="Nacht" title={formatNight(date)}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Link
                href={`/sleep?date=${prevDate}`}
                className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9ca3af] hover:text-white hover:border-[#4a4a4a] transition-colors`}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {formatLongDate(prevDate).split(",")[0]}
              </Link>
              {!isToday && (
                <Link
                  href="/sleep"
                  className={`${spaceMono.className} inline-flex items-center rounded-md border border-[#FF6A00]/40 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#FF6A00] hover:bg-[#FF6A00]/10 transition-colors`}
                >
                  Heute
                </Link>
              )}
              <Link
                href={`/sleep?date=${nextDate}`}
                className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9ca3af] hover:text-white hover:border-[#4a4a4a] transition-colors`}
              >
                {formatLongDate(nextDate).split(",")[0]}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {!sleep && !night && (
              <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-black/40 p-10 text-center">
                <p className="font-semibold text-white">
                  Keine Schlafdaten für diese Nacht.
                </p>
                <p className="mt-1 text-sm text-[#9ca3af]">
                  Sync via Button auf <code>/</code> oder{" "}
                  <code>POST /api/sync/sleep</code>.
                </p>
              </div>
            )}
            {(sleep || night) && (
              <div className="text-xs text-[#9ca3af]">
                Quellen: {sleep ? "Sleep-API" : ""}
                {sleep && night ? " + " : ""}
                {night ? "Nightly-Recharge" : ""}
              </div>
            )}
          </BentoTile>
        </div>

        {sleep && (
          <>
            {/* Score */}
            <div className="md:col-span-2">
              <BentoTile label="Score" title="Schlaf-Score">
                <div className="flex flex-col items-center py-2">
                  <div style={{ fontSize: "72px" }}>
                    <LedValue
                      value={String(sleep.sleepScore ?? "-")}
                      color="#FF6A00"
                    />
                  </div>
                  <div
                    className={`${spaceMono.className} text-[10px] uppercase tracking-[0.2em] text-[#a3a3a3] mt-1`}
                  >
                    von 100
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 w-full">
                    {metricBox({
                      value: String(sleep.sleepCharge ?? "-"),
                      label: "Charge",
                    })}
                    {metricBox({
                      value: String(sleep.sleepRating ?? "-"),
                      label: "Rating",
                    })}
                  </div>
                </div>
              </BentoTile>
            </div>

            {/* Dauer & Zeiten */}
            <div className="md:col-span-2">
              <BentoTile label="Dauer" title="Zeiten">
                <div className="grid grid-cols-2 gap-2">
                  {metricBox({ value: fmtHours(total), label: "Total" })}
                  {metricBox({
                    value: fmtHours(sleep.sleepGoalSec),
                    label: "Ziel",
                  })}
                  {metricBox({
                    value: fmtTime(sleep.sleepStartTime),
                    label: "Start",
                  })}
                  {metricBox({
                    value: fmtTime(sleep.sleepEndTime),
                    label: "Ende",
                  })}
                  {metricBox({
                    value:
                      sleep.continuity != null
                        ? sleep.continuity.toFixed(1)
                        : "–",
                    label: "Kontinuität",
                  })}
                  {metricBox({
                    value: String(sleep.continuityClass ?? "–"),
                    label: "Kont.-Klasse",
                  })}
                </div>
              </BentoTile>
            </div>

            {/* Interruptions */}
            <div className="md:col-span-2">
              <BentoTile label="Störungen" title="Unterbrechungen">
                <div className="grid grid-cols-2 gap-2">
                  {metricBox({
                    value: fmtHours(sleep.shortInterruptionSec),
                    label: "Kurz",
                  })}
                  {metricBox({
                    value: fmtHours(sleep.longInterruptionSec),
                    label: "Lang",
                  })}
                  {metricBox({
                    value: fmtHours(sleep.totalInterruptionSec),
                    label: "Total",
                  })}
                  {metricBox({
                    value: String(sleep.sleepCycles ?? "–"),
                    label: "Zyklen",
                  })}
                </div>
              </BentoTile>
            </div>

            {/* Sleep Stages */}
            <div className="md:col-span-3">
              <BentoTile label="Phasen" title="Schlafphasen">
                <div className="grid grid-cols-4 gap-2">
                  {metricBox({
                    value: fmtHours(sleep.deepSleepSec),
                    label: `Tief ${pct(sleep.deepSleepSec, total)}`,
                  })}
                  {metricBox({
                    value: fmtHours(sleep.lightSleepSec),
                    label: `Leicht ${pct(sleep.lightSleepSec, total)}`,
                  })}
                  {metricBox({
                    value: fmtHours(sleep.remSleepSec),
                    label: `REM ${pct(sleep.remSleepSec, total)}`,
                  })}
                  {metricBox({
                    value: fmtHours(sleep.unrecognizedSleepSec),
                    label: `Unbek. ${pct(sleep.unrecognizedSleepSec, total)}`,
                  })}
                </div>
                {/* Stacked bar */}
                {total ? (
                  <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-black/40 flex">
                    {[
                      { sec: sleep.deepSleepSec, color: "#3b82f6" },
                      { sec: sleep.lightSleepSec, color: "#60a5fa" },
                      { sec: sleep.remSleepSec, color: "#a855f7" },
                      { sec: sleep.unrecognizedSleepSec, color: "#6b7280" },
                    ].map((p, i) =>
                      p.sec && p.sec > 0 ? (
                        <div
                          key={i}
                          style={{
                            width: `${((p.sec ?? 0) / total) * 100}%`,
                            background: p.color,
                          }}
                        />
                      ) : null
                    )}
                  </div>
                ) : null}
              </BentoTile>
            </div>

            {/* Gruppen-Scores */}
            <div className="md:col-span-3">
              <BentoTile label="Qualität" title="Gruppen-Scores">
                <div className="grid grid-cols-3 gap-2">
                  {metricBox({
                    value: String(sleep.groupDurationScore ?? "–"),
                    label: "Dauer",
                  })}
                  {metricBox({
                    value: String(sleep.groupSolidityScore ?? "–"),
                    label: "Solidität",
                  })}
                  {metricBox({
                    value: String(sleep.groupRegenerationScore ?? "–"),
                    label: "Erholung",
                  })}
                </div>
                <div className="mt-3 text-[11px] text-[#9ca3af]">
                  Device: {sleep.deviceId ?? "–"} · Polar-User:{" "}
                  {sleep.polarUserId ?? "–"}
                </div>
              </BentoTile>
            </div>
          </>
        )}

        {/* Nightly Recharge */}
        {night && (
          <div className="md:col-span-6">
            <BentoTile label="Recharge" title="Nightly Recharge">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {metricBox({
                  value: String(night.nightlyRechargeStatus ?? "–"),
                  label: "Status",
                })}
                {metricBox({
                  value:
                    night.heartRateAvg != null
                      ? Math.round(night.heartRateAvg).toString()
                      : "–",
                  label: "HR Ø",
                })}
                {metricBox({
                  value:
                    night.heartRateVariabilityAvg != null
                      ? Math.round(night.heartRateVariabilityAvg).toString()
                      : "–",
                  label: "HRV Ø",
                })}
                {metricBox({
                  value:
                    night.breathingRateAvg != null
                      ? night.breathingRateAvg.toFixed(1)
                      : "–",
                  label: "Atmung",
                })}
                {metricBox({
                  value:
                    night.beatToBeatAvg != null
                      ? Math.round(night.beatToBeatAvg).toString()
                      : "–",
                  label: "Beat-to-Beat",
                })}
                {metricBox({
                  value:
                    night.ansCharge != null
                      ? night.ansCharge.toFixed(1)
                      : "–",
                  label: "ANS Charge",
                })}
                {metricBox({
                  value: String(night.ansChargeStatus ?? "–"),
                  label: "ANS Status",
                })}
                {metricBox({
                  value: String(night.sleepCharge ?? "–"),
                  label: "Sleep Charge",
                })}
                {metricBox({
                  value: String(night.sleepChargeStatus ?? "–"),
                  label: "Sleep Charge Status",
                })}
              </div>
            </BentoTile>
          </div>
        )}

        {/* Hypnogram */}
        {sleep?.hypnogram != null && (
          <div className="md:col-span-6">
            <BentoTile label="Verlauf" title="Hypnogram">
              <SleepHypnogram
                hypnogram={sleep.hypnogram}
                sleepStart={sleep.sleepStartTime}
                sleepEnd={sleep.sleepEndTime}
              />
            </BentoTile>
          </div>
        )}

        {/* HR während Nacht */}
        {sleep?.heartRateSamples != null && (
          <div className="md:col-span-6">
            <BentoTile label="Herzfrequenz" title="HR während Nacht">
              <SleepHrChart
                samples={sleep.heartRateSamples}
                sleepStart={sleep.sleepStartTime}
              />
            </BentoTile>
          </div>
        )}

        {/* Historie */}
        {historyData.length > 0 && (
          <div className="md:col-span-6">
            <BentoTile label="Historie" title="Letzte 14 Nächte">
              <SleepHistoryChart data={historyData} />
            </BentoTile>
          </div>
        )}

        {/* Raw JSON */}
        {(sleep || night) && (
          <div className="md:col-span-6">
            <BentoTile label="Rohdaten" title="Import-Debug">
              <details className="text-xs">
                <summary className="cursor-pointer text-[#9ca3af] hover:text-white">
                  Vollständige API-Responses anzeigen
                </summary>
                {sleep && (
                  <div className="mt-3">
                    <div
                      className={`${spaceMono.className} text-[10px] uppercase tracking-[0.18em] text-[#a3a3a3] mb-1`}
                    >
                      /v3/users/sleep/{date}
                    </div>
                    <pre className="max-h-96 overflow-auto rounded-md border border-[#2a2a2a] bg-black/50 p-3 text-[11px] text-[#e5e7eb]">
                      {JSON.stringify(sleep.raw, null, 2)}
                    </pre>
                  </div>
                )}
                {night && (
                  <div className="mt-3">
                    <div
                      className={`${spaceMono.className} text-[10px] uppercase tracking-[0.18em] text-[#a3a3a3] mb-1`}
                    >
                      /v3/users/nights/{date}
                    </div>
                    <pre className="max-h-96 overflow-auto rounded-md border border-[#2a2a2a] bg-black/50 p-3 text-[11px] text-[#e5e7eb]">
                      {JSON.stringify(night.raw, null, 2)}
                    </pre>
                  </div>
                )}
              </details>
            </BentoTile>
          </div>
        )}
      </div>
    </BentoPageShell>
  );
}
