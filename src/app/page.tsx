import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from "./components/navbar";
import Link from "next/link";
import { rajdhani, spaceMono } from "./components/bento/bento-fonts";
import { BentoSyncButton } from "./components/bento/home/bento-sync-button";
import { BentoHomeWeekly } from "./components/bento/home/bento-home-weekly";
import { BentoHomeGoals } from "./components/bento/home/bento-home-goals";
import { BentoHomeLevelTrophies } from "./components/bento/home/bento-home-level-trophies";
import { BentoDashboardHero } from "./components/bento/home/bento-dashboard-hero";
import { BentoDashboardStreak } from "./components/bento/home/bento-dashboard-streak";
import { BentoDashboardMonthly } from "./components/bento/home/bento-dashboard-monthly";
import { BentoDashboardWeight } from "./components/bento/home/bento-dashboard-weight";
import { BentoDashboardBp } from "./components/bento/home/bento-dashboard-bp";
import { BentoDashboardHeatmap } from "./components/bento/home/bento-dashboard-heatmap";
import { BentoDashboardMonthlyKm } from "./components/bento/home/bento-dashboard-monthly-km";
import { BentoDashboardMonthlyActivities } from "./components/bento/home/bento-dashboard-monthly-activities";
import { BentoDashboardSports } from "./components/bento/home/bento-dashboard-sports";
import { BentoDashboardSteps } from "./components/bento/home/bento-dashboard-steps";

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
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 space-y-4">
        <div className="flex items-end justify-between border-b border-[#1f1f1f] pb-4">
          <div>
            <div
              className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.3em] text-[#6b6b6b] mb-1`}
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
          <div className="flex items-center gap-3">
            <Link
              href="/activities"
              className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b6b] hover:text-white hover:border-[#4a4a4a]`}
            >
              Aktivitäten →
            </Link>
            <BentoSyncButton />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:auto-rows-min md:[grid-auto-flow:row_dense]">
          {/* Hero: latest activity */}
          <div className="md:col-span-4 md:row-span-2">
            <BentoDashboardHero userId={userId} />
          </div>
          {/* 2×2 mini-grid next to map: weekly / monthly / level+trophies / streak */}
          <div className="md:col-span-2 md:row-span-2 grid grid-cols-2 grid-rows-2 gap-3">
            <BentoHomeWeekly userId={userId} />
            <BentoDashboardMonthly userId={userId} />
            <BentoHomeLevelTrophies userId={userId} />
            <BentoDashboardStreak userId={userId} />
          </div>

          {/* Goals full width, three abreast */}
          <div className="md:col-span-6">
            <BentoHomeGoals userId={userId} />
          </div>

          {/* Sport breakdown full width */}
          <div className="md:col-span-6">
            <BentoDashboardSports userId={userId} />
          </div>

          {/* Monthly split: km + count line charts */}
          <div className="md:col-span-3">
            <BentoDashboardMonthlyKm userId={userId} />
          </div>
          <div className="md:col-span-3">
            <BentoDashboardMonthlyActivities userId={userId} />
          </div>

          {/* Health row */}
          <div className="md:col-span-2">
            <BentoDashboardWeight userId={userId} />
          </div>
          <div className="md:col-span-2">
            <BentoDashboardBp userId={userId} />
          </div>
          <div className="md:col-span-2">
            <BentoDashboardSteps userId={userId} />
          </div>

          {/* Heatmap full width */}
          <div className="md:col-span-6">
            <BentoDashboardHeatmap userId={userId} />
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
