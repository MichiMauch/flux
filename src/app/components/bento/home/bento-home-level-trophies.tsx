import Link from "next/link";
import { Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { userTrophies } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { computeLevel } from "@/lib/trophies-server";
import { formatXp, getTrophy, tierColor } from "@/lib/trophies";
import { TrophyIcon } from "@/app/components/trophy-icon";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";

const NEON = "#FF6A00";

export async function BentoHomeLevelTrophies({ userId }: { userId: string }) {
  const [level, trophies] = await Promise.all([
    computeLevel(userId),
    db
      .select({
        code: userTrophies.trophyCode,
        unlockedAt: userTrophies.unlockedAt,
      })
      .from(userTrophies)
      .where(eq(userTrophies.userId, userId))
      .orderBy(desc(userTrophies.unlockedAt)),
  ]);

  return (
    <Link
      href="/trophies"
      className="flex h-full flex-col rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-3 hover:border-[#2a2a2a] transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6b6b]`}
        >
          <Trophy className="h-3 w-3" style={{ color: NEON }} /> Level & Trophäen
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em]`}
          style={{ color: NEON }}
        >
          →
        </span>
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
              className={`${spaceMono.className} text-[9px] font-bold text-[#6b6b6b] uppercase tracking-[0.12em]`}
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
          <div className="relative h-3 rounded-sm bg-[#0a0a0a] border border-[#1f1f1f] overflow-hidden">
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
            className={`${spaceMono.className} text-[9px] text-[#6b6b6b] mt-1 tabular-nums uppercase tracking-[0.1em] text-center`}
          >
            {Math.round(level.xpIntoLevel)} / {Math.round(level.xpForNextLevel)} → Lvl {level.level + 1}
          </div>
        </div>
      </div>

      {trophies.length > 0 && (
        <div className="flex-1 min-h-0 grid grid-cols-6 gap-1.5 content-start">
          {trophies.map((r) => {
            const def = getTrophy(r.code);
            if (!def) return null;
            const color = tierColor(def.tier);
            const glow = color.includes("amber")
              ? "#D97706"
              : color.includes("slate")
                ? "#94A3B8"
                : color.includes("yellow")
                  ? "#FDE047"
                  : NEON;
            return (
              <span
                key={r.code}
                title={`${def.title} · ${new Date(r.unlockedAt).toLocaleDateString("de-CH")}`}
                className="flex aspect-square items-center justify-center rounded-md border border-[#1f1f1f] bg-[#0a0a0a]"
                style={{ boxShadow: `inset 0 0 6px ${glow}22` }}
              >
                <span style={{ color: glow, filter: `drop-shadow(0 0 4px ${glow}88)` }}>
                  <TrophyIcon name={def.icon} className="h-3.5 w-3.5" />
                </span>
              </span>
            );
          })}
        </div>
      )}
    </Link>
  );
}
