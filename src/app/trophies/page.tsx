import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  loadTrophyState,
  computeLevel,
} from "@/lib/trophies-server";
import { TrophyIcon } from "@/app/components/trophy-icon";
import { TrophyRescanButton } from "@/app/components/trophy-rescan-button";
import { tierColor, formatXp, type TrophyCategory } from "@/lib/trophies";
import { Trophy, Lock, CheckCircle2 } from "lucide-react";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { BentoTile } from "../components/bento/bento-tile";
import { rajdhani, spaceMono } from "../components/bento/bento-fonts";

const CATEGORY_LABEL: Record<TrophyCategory, string> = {
  single: "Einzelne Aktivität",
  lifetime_distance: "Distanz",
  lifetime_ascent: "Höhenmeter",
  lifetime_count: "Anzahl Aktivitäten",
  lifetime_duration: "Bewegungszeit",
  streak: "Streaks",
  special: "Spezial",
};

const CATEGORY_ORDER: TrophyCategory[] = [
  "single",
  "lifetime_distance",
  "lifetime_ascent",
  "lifetime_count",
  "lifetime_duration",
  "streak",
  "special",
];

function formatProgress(
  v: number,
  unit: "km" | "m" | "h" | ""
): string {
  if (unit === "km") return `${Math.round(v * 10) / 10} km`;
  if (unit === "m") return `${Math.round(v).toLocaleString("de-CH")} m`;
  if (unit === "h") return `${Math.round(v * 10) / 10} h`;
  return Math.round(v).toString();
}

export default async function TrophiesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [state, level] = await Promise.all([
    loadTrophyState(session.user.id),
    computeLevel(session.user.id),
  ]);

  const unlockedCount = state.filter((s) => s.unlockedAt).length;

  const grouped = new Map<TrophyCategory, typeof state>();
  for (const s of state) {
    const arr = grouped.get(s.def.category) ?? [];
    arr.push(s);
    grouped.set(s.def.category, arr);
  }

  return (
    <BentoPageShell>
      <BentoPageHeader
        section="Trophies"
        title="Trophäen"
        right={
          <div className="flex items-center gap-3">
            <div
              className={`${spaceMono.className} text-[11px] text-[#9ca3af] tabular-nums`}
            >
              {unlockedCount} / {state.length}
            </div>
            <TrophyRescanButton />
          </div>
        }
      />

      <BentoTile label="Level" title={`Level ${level.level}`}>
        <div className="flex items-center gap-4">
          <div
            className={`${rajdhani.className} flex h-16 w-16 items-center justify-center rounded-full bg-[#FF6A00] text-black font-bold text-3xl`}
            style={{
              textShadow: "0 0 12px rgba(255,106,0,0.4)",
            }}
          >
            {level.level}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className={`${rajdhani.className} text-2xl font-bold text-white`}
            >
              {formatXp(level.totalXp)}
            </div>
            <div className="relative mt-2 h-2 rounded-full bg-black/60 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#FF6A00]"
                style={{ width: `${Math.min(100, level.progressPct)}%` }}
              />
            </div>
            <div
              className={`${spaceMono.className} mt-1 text-[10px] text-[#9ca3af] tabular-nums`}
            >
              {Math.round(level.xpIntoLevel)} /{" "}
              {Math.round(level.xpForNextLevel)} XP → Level {level.level + 1}
            </div>
          </div>
        </div>
      </BentoTile>

      {CATEGORY_ORDER.map((cat) => {
        const items = grouped.get(cat);
        if (!items || items.length === 0) return null;
        return (
          <section key={cat} className="space-y-3">
            <h2
              className={`${spaceMono.className} text-[11px] font-bold uppercase tracking-[0.2em] text-[#a3a3a3]`}
            >
              {CATEGORY_LABEL[cat]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(({ def, unlockedAt, progress }) => {
                const isUnlocked = !!unlockedAt;
                return (
                  <div
                    key={def.code}
                    className={`rounded-xl border p-4 transition-colors ${
                      isUnlocked
                        ? "border-[#2a2a2a] bg-[#0f0f0f]"
                        : "border-dashed border-[#2a2a2a] bg-[#0f0f0f]/50 opacity-80"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                          isUnlocked ? "bg-black/60" : "bg-black/40"
                        }`}
                      >
                        {isUnlocked ? (
                          <TrophyIcon
                            name={def.icon}
                            className={`h-5 w-5 ${tierColor(def.tier)}`}
                          />
                        ) : (
                          <Lock className="h-4 w-4 text-[#9ca3af]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-sm font-bold truncate text-white">
                          {def.title}
                          {isUnlocked && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                          )}
                        </div>
                        <div className="text-xs text-[#9ca3af]">
                          {def.description}
                        </div>
                        {!isUnlocked && progress && (
                          def.criterion.kind === "single_activity" ? (
                            <div
                              className={`${spaceMono.className} mt-1.5 text-[10px] text-[#9ca3af] tabular-nums`}
                            >
                              Bestwert:{" "}
                              {formatProgress(
                                progress.currentValue,
                                progress.unit
                              )}
                            </div>
                          ) : (
                            <>
                              <div className="relative mt-2 h-1.5 rounded-full bg-black/60 overflow-hidden">
                                <div
                                  className="absolute inset-y-0 left-0 bg-[#FF6A00]"
                                  style={{
                                    width: `${Math.min(100, progress.progressPct)}%`,
                                  }}
                                />
                              </div>
                              <div
                                className={`${spaceMono.className} mt-1 text-[10px] text-[#9ca3af] tabular-nums`}
                              >
                                {formatProgress(
                                  progress.currentValue,
                                  progress.unit
                                )}{" "}
                                /{" "}
                                {formatProgress(
                                  progress.targetValue,
                                  progress.unit
                                )}
                              </div>
                            </>
                          )
                        )}
                        {isUnlocked && unlockedAt && (
                          <div
                            className={`${spaceMono.className} mt-1.5 text-[10px] text-[#9ca3af]`}
                          >
                            {new Date(unlockedAt).toLocaleDateString("de-CH")}{" "}
                            · +{def.xpReward} XP
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {state.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#2a2a2a] bg-[#0f0f0f] p-10 text-center space-y-2">
          <Trophy className="h-10 w-10 mx-auto text-[#a3a3a3]" />
          <p className="font-semibold text-white">Noch keine Trophäen</p>
        </div>
      )}
    </BentoPageShell>
  );
}
