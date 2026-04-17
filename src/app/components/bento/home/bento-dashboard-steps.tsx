import { Footprints } from "lucide-react";
import { db } from "@/lib/db";
import { dailyActivity } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { BentoDashboardStepsChart } from "./bento-dashboard-steps-chart";

const NEON = "#FF6A00";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export async function BentoDashboardSteps({ userId }: { userId: string }) {
  const raw = await db
    .select({
      date: dailyActivity.date,
      steps: dailyActivity.steps,
      activeSteps: dailyActivity.activeSteps,
    })
    .from(dailyActivity)
    .where(eq(dailyActivity.userId, userId))
    .orderBy(desc(dailyActivity.date))
    .limit(7);

  const rows = raw.map((r) => ({
    date: r.date,
    steps: r.steps ?? r.activeSteps ?? 0,
  }));

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col">
        <div className="flex items-center gap-1.5 mb-3">
          <Footprints className="h-3 w-3" style={{ color: NEON }} />
          <span
            className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
          >
            Schritte
          </span>
        </div>
        <div
          className={`flex-1 flex items-center justify-center ${spaceMono.className} text-xs text-[#a3a3a3]`}
        >
          Keine Daten
        </div>
      </div>
    );
  }

  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    const row = rows.find((r) => r.date === k);
    days.push({
      key: k,
      label: WEEKDAYS[d.getDay()],
      dateLabel: d.toLocaleDateString("de-CH", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }),
      steps: row?.steps ?? 0,
      isToday: i === 0,
    });
  }

  const activeDays = days.filter((d) => d.steps > 0);
  const avg = activeDays.length
    ? Math.round(activeDays.reduce((s, d) => s + d.steps, 0) / activeDays.length)
    : 0;

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Footprints className="h-3 w-3" style={{ color: NEON }} />
          Schritte · 7 Tage
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3] tabular-nums`}
        >
          Ø {avg.toLocaleString("de-CH")}
        </span>
      </div>
      <BentoDashboardStepsChart days={days} />
    </div>
  );
}
