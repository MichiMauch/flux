import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { bloodPressureSessions, weightMeasurements, users } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { BloodPressureChart } from "../components/blood-pressure-chart";
import { WeightChart } from "../components/weight-chart";
import { WithingsConnect } from "../components/withings-connect";
import { BpSyncButton } from "../components/bp-sync-button";
import Link from "next/link";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { BentoTile } from "../components/bento/bento-tile";
import { rajdhani, spaceMono } from "../components/bento/bento-fonts";

export default async function HealthPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  const withingsConnected = !!user?.withingsAccessToken;

  const weightData = await db
    .select()
    .from(weightMeasurements)
    .where(eq(weightMeasurements.userId, session.user.id))
    .orderBy(desc(weightMeasurements.date))
    .limit(100);

  const latestWeight = weightData[0];

  const bpData = await db
    .select()
    .from(bloodPressureSessions)
    .where(eq(bloodPressureSessions.userId, session.user.id))
    .orderBy(
      desc(
        sql`coalesce(${bloodPressureSessions.measuredAt}, ${bloodPressureSessions.createdAt})`
      )
    )
    .limit(100);

  const latestBp = bpData[0];

  type Stat = { value: string; label: string };
  const metricBox = ({ value, label }: Stat) => (
    <div
      key={label}
      className="rounded-lg border border-[#2a2a2a] bg-black/40 p-3 text-center"
    >
      <div className={`${rajdhani.className} text-2xl font-bold text-white`}>
        {value}
      </div>
      <div
        className={`${spaceMono.className} mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3]`}
      >
        {label}
      </div>
    </div>
  );

  const weightStats: Stat[] = latestWeight
    ? [
        { value: latestWeight.weight.toFixed(1), label: "kg" },
        ...(latestWeight.fatMass != null
          ? [{ value: latestWeight.fatMass.toFixed(1), label: "Fett (kg)" }]
          : []),
        ...(latestWeight.muscleMass != null
          ? [{ value: latestWeight.muscleMass.toFixed(1), label: "Muskel (kg)" }]
          : []),
        ...(latestWeight.bmi != null
          ? [{ value: latestWeight.bmi.toFixed(1), label: "BMI" }]
          : []),
      ]
    : [];

  const bpStats: Stat[] = latestBp
    ? [
        { value: `${latestBp.systolicAvg}`, label: "Systolisch" },
        { value: `${latestBp.diastolicAvg}`, label: "Diastolisch" },
        { value: latestBp.pulseAvg != null ? `${latestBp.pulseAvg.toFixed(0)}` : "–", label: "Puls" },
      ]
    : [];

  return (
    <BentoPageShell>
      <BentoPageHeader section="Health" title="Gesundheit" />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:auto-rows-min md:[grid-auto-flow:row_dense]">
        <div className="md:col-span-6">
          <BentoTile
            label="Gewicht"
            title="Körperwerte"
            right={withingsConnected ? <WithingsConnect connected /> : null}
          >
            {!withingsConnected ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm mb-4 text-[#9ca3af]">
                  Verbinde Withings, um Gewichtsdaten zu sehen.
                </p>
                <Link
                  href="/api/withings/authorize"
                  className={`${spaceMono.className} inline-flex items-center rounded-md border border-[#FF6A00]/40 bg-[#FF6A00]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#FF6A00] hover:bg-[#FF6A00]/20 transition-colors`}
                >
                  Withings verbinden
                </Link>
              </div>
            ) : weightData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <p className="text-sm text-[#9ca3af]">
                  Noch keine Gewichtsdaten. Sync starten.
                </p>
                <WithingsConnect connected />
              </div>
            ) : (
              <div>
                {latestWeight && weightStats.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    {weightStats.map(metricBox)}
                  </div>
                )}
                <div style={{ height: 300 }}>
                  <WeightChart
                    data={weightData
                      .reverse()
                      .map((d) => ({
                        date: d.date.toLocaleDateString("de-CH"),
                        weight: d.weight,
                        fatMass: d.fatMass,
                      }))}
                  />
                </div>
              </div>
            )}
          </BentoTile>
        </div>

        <div className="md:col-span-6">
          <BentoTile
            label="Blutdruck"
            title="Herz & Kreislauf"
            right={<BpSyncButton />}
          >
            {bpData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <p className="text-sm text-[#9ca3af]">
                  Noch keine Blutdruck-Daten.
                </p>
              </div>
            ) : (
              <div>
                {latestBp && (
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {bpStats.map(metricBox)}
                  </div>
                )}
                <div style={{ height: 300 }}>
                  <BloodPressureChart
                    data={bpData
                      .reverse()
                      .map((d) => ({
                        date: d.date,
                        systolic: d.systolicAvg,
                        diastolic: d.diastolicAvg,
                        pulse: d.pulseAvg ?? 0,
                      }))}
                  />
                </div>
              </div>
            )}
          </BentoTile>
        </div>
      </div>
    </BentoPageShell>
  );
}
