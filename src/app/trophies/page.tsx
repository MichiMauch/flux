import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/app/components/navbar";
import {
  loadTrophyState,
  computeLevel,
} from "@/lib/trophies-server";
import { TrophyIcon } from "@/app/components/trophy-icon";
import { TrophyRescanButton } from "@/app/components/trophy-rescan-button";
import { tierColor, formatXp, type TrophyCategory } from "@/lib/trophies";
import { Trophy, Lock, CheckCircle2 } from "lucide-react";

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
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-[-0.025em]">Trophäen</h1>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground tabular-nums">
              {unlockedCount} / {state.length} freigeschaltet
            </div>
            <TrophyRescanButton />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface/40 p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-background font-bold text-xl">
              {level.level}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Level
              </div>
              <div className="text-lg font-bold">
                {formatXp(level.totalXp)}
              </div>
              <div className="relative mt-2 h-2 rounded-full bg-surface overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-brand"
                  style={{ width: `${Math.min(100, level.progressPct)}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                {Math.round(level.xpIntoLevel)} /{" "}
                {Math.round(level.xpForNextLevel)} XP bis Level{" "}
                {level.level + 1}
              </div>
            </div>
          </div>
        </div>

        {CATEGORY_ORDER.map((cat) => {
          const items = grouped.get(cat);
          if (!items || items.length === 0) return null;
          return (
            <section key={cat} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {CATEGORY_LABEL[cat]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ def, unlockedAt, progress }) => {
                  const isUnlocked = !!unlockedAt;
                  return (
                    <div
                      key={def.code}
                      className={`rounded-lg border p-4 transition-colors ${
                        isUnlocked
                          ? "border-border bg-background"
                          : "border-dashed border-border bg-surface/30 opacity-80"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
                            isUnlocked
                              ? "bg-surface"
                              : "bg-surface/60"
                          }`}
                        >
                          {isUnlocked ? (
                            <TrophyIcon
                              name={def.icon}
                              className={`h-5 w-5 ${tierColor(def.tier)}`}
                            />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 text-sm font-bold truncate">
                            {def.title}
                            {isUnlocked && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-700 shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {def.description}
                          </div>
                          {!isUnlocked && progress && (
                            def.criterion.kind === "single_activity" ? (
                              <div className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
                                Bestwert:{" "}
                                {formatProgress(
                                  progress.currentValue,
                                  progress.unit
                                )}
                              </div>
                            ) : (
                              <>
                                <div className="relative mt-2 h-1.5 rounded-full bg-surface overflow-hidden">
                                  <div
                                    className="absolute inset-y-0 left-0 bg-brand"
                                    style={{
                                      width: `${Math.min(100, progress.progressPct)}%`,
                                    }}
                                  />
                                </div>
                                <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
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
                            <div className="mt-1.5 text-[10px] text-muted-foreground">
                              Freigeschaltet am{" "}
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
          <div className="rounded-lg border border-dashed border-border p-10 text-center space-y-2">
            <Trophy className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-semibold">Noch keine Trophäen</p>
          </div>
        )}
      </main>
    </>
  );
}
