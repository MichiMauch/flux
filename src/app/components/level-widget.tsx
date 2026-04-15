import Link from "next/link";
import { Trophy } from "lucide-react";
import { computeLevel, getRecentTrophies } from "@/lib/trophies-server";
import { getTrophy, tierColor, formatXp } from "@/lib/trophies";
import { TrophyIcon } from "./trophy-icon";

export async function LevelWidget({ userId }: { userId: string }) {
  const [level, recent] = await Promise.all([
    computeLevel(userId),
    getRecentTrophies(userId, 3),
  ]);

  return (
    <Link
      href="/trophies"
      className="block rounded-lg border border-border bg-surface/40 p-3 hover:bg-surface transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Trophy className="h-3 w-3" /> Level
        </span>
        <span className="text-[10px] font-semibold text-brand">Trophäen →</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-background font-bold">
          {level.level}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold tabular-nums">
            {formatXp(level.totalXp)}
          </div>
          <div className="relative mt-1 h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-brand"
              style={{ width: `${Math.min(100, level.progressPct)}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
            {Math.round(level.xpIntoLevel)} /{" "}
            {Math.round(level.xpForNextLevel)} bis Lvl {level.level + 1}
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
            Zuletzt erreicht
          </div>
          <div className="flex gap-2">
            {recent.map((r) => {
              const def = getTrophy(r.code);
              if (!def) return null;
              return (
                <div
                  key={r.code}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-surface"
                  title={def.title}
                >
                  <TrophyIcon
                    name={def.icon}
                    className={`h-4 w-4 ${tierColor(def.tier)}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Link>
  );
}
