import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { rajdhani, spaceMono } from "./components/bento/bento-fonts";
import { BentoHomeWeekly } from "./components/bento/home/bento-home-weekly";
import { BentoHomeGoals } from "./components/bento/home/bento-home-goals";
import { BentoHomeLevelTrophies } from "./components/bento/home/bento-home-level-trophies";
import { BentoDashboardHero } from "./components/bento/home/bento-dashboard-hero";
import { BentoDashboardStreak } from "./components/bento/home/bento-dashboard-streak";
import { BentoDashboardMonthly } from "./components/bento/home/bento-dashboard-monthly";
import { BentoDashboardWeight } from "./components/bento/home/bento-dashboard-weight";
import { BentoDashboardForm } from "./components/bento/home/bento-dashboard-form";
import { BentoDashboardBp } from "./components/bento/home/bento-dashboard-bp";
import { BentoDashboardSleepAvg } from "./components/bento/home/bento-dashboard-sleep-avg";
import { BentoDashboardMonthlyKm } from "./components/bento/home/bento-dashboard-monthly-km";
import { BentoDashboardMonthlyActivities } from "./components/bento/home/bento-dashboard-monthly-activities";
import { BentoDashboardSports } from "./components/bento/home/bento-dashboard-sports";
import { BentoDashboardSteps } from "./components/bento/home/bento-dashboard-steps";
import { BentoDashboardYtdDistance } from "./components/bento/home/bento-dashboard-ytd-distance";
import { BentoDashboardYtdAscent } from "./components/bento/home/bento-dashboard-ytd-ascent";
import { BentoDashboardYtdTime } from "./components/bento/home/bento-dashboard-ytd-time";
import { BentoDashboardConsistency } from "./components/bento/home/bento-dashboard-consistency";
import { BentoDashboardRecords } from "./components/bento/home/bento-dashboard-records";

const NEON = "#FF6A00";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = session.user.id;

  const greetingName = session.user.name?.split(" ")[0] ?? "Du";

  return (
    <div
      className="dark min-h-screen bg-black text-white relative"
      style={{
        fontFeatureSettings: '"ss01", "cv11"',
        ["--bento-mono" as string]: spaceMono.style.fontFamily,
        backgroundImage:
          "linear-gradient(rgba(255,106,0,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,106,0,0.035) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      <main className="mx-auto w-full max-w-7xl px-4 py-6 space-y-4">
        <div className="flex items-end justify-between border-b border-[#2a2a2a] pb-4">
          <div>
            <div
              className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.3em] text-[#a3a3a3] mb-1`}
            >
              ► FLUX // DASHBOARD ·{" "}
              {new Date()
                .toLocaleDateString("de-CH", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
                .toUpperCase()}
            </div>
            <h1
              className={`${rajdhani.className} font-bold uppercase leading-none tracking-[-0.02em]`}
              style={{
                fontSize: "clamp(48px, 7vw, 96px)",
                color: NEON,
                textShadow: `0 0 18px ${NEON}88, 0 0 40px ${NEON}55, 0 0 80px ${NEON}22`,
              }}
            >
              Hallo {greetingName}
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:auto-rows-min md:[grid-auto-flow:row_dense]">
          {/* Hero: latest activity */}
          <div className="md:col-span-4 md:row-span-2">
            <BentoDashboardHero userId={userId} />
          </div>
          {/* 2×2 mini-grid next to map: YTD distance / ascent / time / streak */}
          <div className="md:col-span-2 md:row-span-2 grid grid-cols-2 grid-rows-2 gap-3">
            <BentoDashboardYtdDistance userId={userId} />
            <BentoDashboardYtdAscent userId={userId} />
            <BentoDashboardYtdTime userId={userId} />
            <BentoDashboardStreak userId={userId} />
          </div>

          {/* Goals + steps */}
          <div className="md:col-span-4">
            <BentoHomeGoals userId={userId} />
          </div>
          <div className="md:col-span-2">
            <BentoDashboardSteps userId={userId} />
          </div>

          {/* Sport breakdown full width */}
          <div className="md:col-span-6">
            <BentoDashboardSports userId={userId} />
          </div>

          {/* Jahresbilanz: consistency + records */}
          <div className="md:col-span-3">
            <BentoDashboardConsistency userId={userId} />
          </div>
          <div className="md:col-span-3">
            <BentoDashboardRecords userId={userId} />
          </div>

          {/* Monthly line charts: km + activities, half-width each */}
          <div className="md:col-span-3">
            <BentoDashboardMonthlyKm userId={userId} />
          </div>
          <div className="md:col-span-3">
            <BentoDashboardMonthlyActivities userId={userId} />
          </div>

          {/* Form (CTL/ATL/TSB) + Weight */}
          <div className="md:col-span-3">
            <BentoDashboardForm userId={userId} />
          </div>
          <div className="md:col-span-3">
            <BentoDashboardWeight userId={userId} />
          </div>

          {/* Sleep + Blood Pressure */}
          <div className="md:col-span-3">
            <BentoDashboardSleepAvg userId={userId} />
          </div>
          <div className="md:col-span-3">
            <BentoDashboardBp userId={userId} />
          </div>

          {/* End: weekly / monthly / level+trophies */}
          <div className="md:col-span-2">
            <BentoHomeWeekly userId={userId} />
          </div>
          <div className="md:col-span-2">
            <BentoDashboardMonthly userId={userId} />
          </div>
          <div className="md:col-span-2">
            <BentoHomeLevelTrophies userId={userId} />
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <Link
            href="/activities"
            className={`${spaceMono.className} inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] border border-[#2a2a2a] text-[#9ca3af] hover:text-white hover:border-[#4a4a4a] transition-colors`}
          >
            Alle Aktivitäten →
          </Link>
        </div>
      </main>
    </div>
  );
}
