import Link from "next/link";
import { Trophy } from "lucide-react";
import { formatXp } from "@/lib/trophies";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";
import { getLevelTrophies } from "@/lib/cache/home-stats";
import { TrophiesGridCollapsible } from "./trophies-grid-collapsible";

const NEON = "#FF6A00";

export async function BentoHomeLevelTrophies({ userId }: { userId: string }) {
  const { level, trophies } = await getLevelTrophies(userId);

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-3">
      <div className="flex items-center justify-between mb-3">
        <Link
          href="/trophies"
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3] hover:text-white transition-colors`}
        >
          <Trophy className="h-3 w-3" style={{ color: NEON }} /> Level & Trophäen
        </Link>
        <Link
          href="/trophies"
          aria-label="Alle Trophäen ansehen"
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em] hover:underline`}
          style={{ color: NEON }}
        >
          →
        </Link>
      </div>

      <div className="flex flex-col items-center gap-2 mb-3">
        <div
          className="flex items-center justify-center"
          style={{ fontSize: "42px" }}
        >
          <SevenSegDisplay value={String(level.level)} />
        </div>
        <div className="w-full">
          <div className="flex items-baseline justify-between mb-1">
            <span
              className={`${spaceMono.className} text-[9px] font-bold text-[#a3a3a3] uppercase tracking-[0.12em]`}
            >
              XP
            </span>
            <span
              className={`${spaceMono.className} text-[10px] font-bold tabular-nums`}
              style={{ color: NEON }}
            >
              {formatXp(level.totalXp)}
            </span>
          </div>
          <div className="relative h-3 rounded-sm bg-[#0a0a0a] border border-[#2a2a2a] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0"
              style={{
                width: `${Math.min(100, level.progressPct)}%`,
                background: `linear-gradient(90deg, ${NEON}cc, ${NEON})`,
                boxShadow: `0 0 10px ${NEON}, 0 0 18px ${NEON}aa, inset 0 0 4px ${NEON}66`,
              }}
            />
          </div>
          <div
            className={`${spaceMono.className} text-[9px] text-[#a3a3a3] mt-1 tabular-nums uppercase tracking-[0.1em] text-center`}
          >
            {Math.round(level.xpIntoLevel)} / {Math.round(level.xpForNextLevel)} → Lvl {level.level + 1}
          </div>
        </div>
      </div>

      <TrophiesGridCollapsible trophies={trophies} />
    </div>
  );
}
