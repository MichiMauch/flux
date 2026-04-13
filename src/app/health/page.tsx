import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from "../components/navbar";
import { db } from "@/lib/db";
import { bloodPressureSessions, weightMeasurements, users } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { BloodPressureChart } from "../components/blood-pressure-chart";
import { WeightChart } from "../components/weight-chart";
import { WithingsConnect } from "../components/withings-connect";
import { BpSyncButton } from "../components/bp-sync-button";
import Link from "next/link";

export default async function HealthPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Check Withings connection
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  const withingsConnected = !!user?.withingsAccessToken;

  // Weight data
  const weightData = await db
    .select()
    .from(weightMeasurements)
    .where(eq(weightMeasurements.userId, session.user.id))
    .orderBy(desc(weightMeasurements.date))
    .limit(100);

  const latestWeight = weightData[0];

  // Blood pressure data
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

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Gesundheit</h1>

        <div className="grid gap-6">
          {/* Weight */}
          <div className="rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Gewicht</h2>
              {withingsConnected && <WithingsConnect connected />}
            </div>
            {!withingsConnected ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <p className="text-sm mb-4">Verbinde Withings, um Gewichtsdaten zu sehen.</p>
                <Link
                  href="/api/withings/authorize"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Withings verbinden
                </Link>
              </div>
            ) : weightData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <p className="text-sm">Noch keine Gewichtsdaten. Sync starten.</p>
                <WithingsConnect connected />
              </div>
            ) : (
              <div>
                {latestWeight && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {latestWeight.weight.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">kg</div>
                    </div>
                    {latestWeight.fatMass != null && (
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {latestWeight.fatMass.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Fettmasse (kg)
                        </div>
                      </div>
                    )}
                    {latestWeight.muscleMass != null && (
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {latestWeight.muscleMass.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Muskelmasse (kg)
                        </div>
                      </div>
                    )}
                    {latestWeight.bmi != null && (
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {latestWeight.bmi.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">BMI</div>
                      </div>
                    )}
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
          </div>

          {/* Blood Pressure */}
          <div className="rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Blutdruck</h2>
              <BpSyncButton />
            </div>
            {bpData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <p className="text-sm">Noch keine Blutdruck-Daten.</p>
              </div>
            ) : (
              <div>
                {latestBp && (
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {latestBp.systolicAvg}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Systolisch
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {latestBp.diastolicAvg}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Diastolisch
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {latestBp.pulseAvg?.toFixed(0) ?? "–"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Puls
                      </div>
                    </div>
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
          </div>
        </div>
      </main>
    </>
  );
}
