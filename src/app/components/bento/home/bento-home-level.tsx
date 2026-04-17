import Link from "next/link";
import { Trophy } from "lucide-react";
import { computeLevel } from "@/lib/trophies-server";
import { formatXp } from "@/lib/trophies";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";

const NEON = "#FF6A00";

export async function BentoHomeLevel({ userId }: { userId: string }) {
  const level = await computeLevel(userId);
  return (
    <Link
      href="/trophies"
      className="flex h-full flex-col rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 hover:border-[#4a4a4a] transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Trophy className="h-3 w-3" style={{ color: NEON }} /> Level
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em]`}
          style={{ color: NEON }}
        >
          Trophäen →
        </span>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: `${NEON}18`,
            border: `1px solid ${NEON}55`,
            boxShadow: `0 0 24px ${NEON}55, inset 0 0 14px ${NEON}22`,
            fontSize: "66px",
          }}
        >
          <SevenSegDisplay value={String(level.level)} />
        </div>
        <div className="w-full">
          <div className="flex items-baseline justify-between mb-1.5">
            <span
              className={`${spaceMono.className} text-[10px] font-bold text-[#a3a3a3] uppercase tracking-[0.12em]`}
            >
              XP
            </span>
            <span
              className={`${spaceMono.className} text-[11px] font-bold tabular-nums`}
              style={{ color: NEON }}
            >
              {formatXp(level.totalXp)}
            </span>
          </div>
          <div className="relative h-4 rounded-sm bg-[#0a0a0a] border border-[#2a2a2a] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0"
              style={{
                width: `${Math.min(100, level.progressPct)}%`,
                background: `linear-gradient(90deg, ${NEON}cc, ${NEON})`,
                boxShadow: `0 0 12px ${NEON}, 0 0 24px ${NEON}aa, inset 0 0 6px ${NEON}66`,
              }}
            />
          </div>
          <div
            className={`${spaceMono.className} text-[10px] text-[#a3a3a3] mt-1.5 tabular-nums uppercase tracking-[0.1em] text-center`}
          >
            {Math.round(level.xpIntoLevel)} / {Math.round(level.xpForNextLevel)} → Lvl {level.level + 1}
          </div>
        </div>
      </div>
    </Link>
  );
}
