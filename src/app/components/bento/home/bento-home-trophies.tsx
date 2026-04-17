import Link from "next/link";
import { Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { userTrophies } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getTrophy, tierColor } from "@/lib/trophies";
import { TrophyIcon } from "@/app/components/trophy-icon";
import { spaceMono } from "../bento-fonts";

const NEON = "#FF6A00";

export async function BentoHomeTrophies({ userId }: { userId: string }) {
  const rows = await db
    .select({
      code: userTrophies.trophyCode,
      unlockedAt: userTrophies.unlockedAt,
    })
    .from(userTrophies)
    .where(eq(userTrophies.userId, userId))
    .orderBy(desc(userTrophies.unlockedAt));

  if (rows.length === 0) return null;

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-3">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Trophy className="h-3 w-3" style={{ color: NEON }} /> Trophäen
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {rows.map((r) => {
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
            <Link
              key={r.code}
              href="/trophies"
              title={`${def.title} · ${new Date(r.unlockedAt).toLocaleDateString("de-CH")}`}
              className="flex aspect-square items-center justify-center rounded-md border border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#4a4a4a] transition-colors"
              style={{ boxShadow: `inset 0 0 6px ${glow}22` }}
            >
              <span style={{ color: glow, filter: `drop-shadow(0 0 4px ${glow}88)` }}>
                <TrophyIcon name={def.icon} className="h-4 w-4" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
