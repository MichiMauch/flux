import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from "../components/navbar";
import { db } from "@/lib/db";
import { bloodPressureSessions } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { BloodPressureChart } from "../components/blood-pressure-chart";

export default async function HealthPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const bpData = await db
    .select()
    .from(bloodPressureSessions)
    .where(eq(bloodPressureSessions.userId, session.user.id))
    .orderBy(desc(bloodPressureSessions.date))
    .limit(100);

  // Latest reading
  const latest = bpData[0];

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Gesundheit</h1>

        <div className="grid gap-6">
          {/* Weight - Withings placeholder */}
          <div className="rounded-lg border p-6">
            <h2 className="font-semibold mb-4">Gewicht</h2>
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm">Verbinde Withings, um Gewichtsdaten zu sehen.</p>
            </div>
          </div>

          {/* Blood Pressure */}
          <div className="rounded-lg border p-6">
            <h2 className="font-semibold mb-4">Blutdruck</h2>
            {bpData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <p className="text-sm">Noch keine Blutdruck-Daten.</p>
              </div>
            ) : (
              <div>
                {/* Latest values */}
                {latest && (
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {latest.systolicAvg}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Systolisch
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {latest.diastolicAvg}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Diastolisch
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {latest.pulseAvg?.toFixed(0) ?? "–"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Puls
                      </div>
                    </div>
                  </div>
                )}

                {/* Chart */}
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
