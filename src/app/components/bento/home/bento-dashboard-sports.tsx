import { Activity as ActivityIcon } from "lucide-react";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";
import { ActivityLottie } from "@/app/components/activity-lottie";

interface TypeConfig {
  label: string;
  color: string;
  lottieType: string;
  match: (t: string) => boolean;
}

const TYPE_CONFIGS: TypeConfig[] = [
  {
    label: "Laufen",
    color: "#FF6A00",
    lottieType: "RUNNING",
    match: (t) => t.includes("RUN") || t.includes("JOG"),
  },
  {
    label: "Rad",
    color: "#00D4FF",
    lottieType: "CYCLING",
    match: (t) => t.includes("CYCL") || t.includes("BIK") || t.includes("RIDE"),
  },
  {
    label: "Wandern",
    color: "#39FF14",
    lottieType: "HIKING",
    match: (t) => t.includes("HIK") || t.includes("TREK"),
  },
  {
    label: "Gehen",
    color: "#FFD700",
    lottieType: "WALKING",
    match: (t) => t.includes("WALK"),
  },
];

const OTHER_CONFIG: TypeConfig = {
  label: "Andere",
  color: "#FFFFFF",
  lottieType: "OTHER",
  match: () => true,
};

function classify(type: string): TypeConfig {
  const t = type.toUpperCase();
  return TYPE_CONFIGS.find((c) => c.match(t)) ?? OTHER_CONFIG;
}

export async function BentoDashboardSports({ userId }: { userId: string }) {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1);
  const to = new Date(now.getFullYear() + 1, 0, 1);

  const rows = await db
    .select({ type: activities.type })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.startTime, from),
        lt(activities.startTime, to)
      )
    );

  const counts = new Map<string, number>();
  for (const r of rows) {
    const label = classify(r.type).label;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const items = [...TYPE_CONFIGS, OTHER_CONFIG]
    .map((c) => ({ config: c, count: counts.get(c.label) ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const total = items.reduce((s, x) => s + x.count, 0);

  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6b6b]`}
        >
          <ActivityIcon className="h-3 w-3 text-white" />
          Sportarten · {now.getFullYear()}
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] text-white tabular-nums`}
        >
          Σ {total}
        </span>
      </div>
      {items.length === 0 ? (
        <div
          className={`flex-1 flex items-center justify-center ${spaceMono.className} text-xs text-[#6b6b6b]`}
        >
          Keine Aktivitäten
        </div>
      ) : (
        <div
          className="grid gap-3 flex-1"
          style={{
            gridTemplateColumns: `repeat(${Math.min(items.length, 6)}, minmax(0, 1fr))`,
          }}
        >
          {items.map(({ config, count }) => (
            <div
              key={config.label}
              className="flex flex-col items-center justify-between gap-2 rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-3"
              style={{ boxShadow: `inset 0 0 10px ${config.color}22` }}
            >
              <div
                style={{ filter: `drop-shadow(0 0 6px ${config.color}66)` }}
              >
                <ActivityLottie
                  activityType={config.lottieType}
                  size={60}
                  tint={config.color}
                />
              </div>
              <div style={{ fontSize: "30px" }}>
                <SevenSegDisplay value={String(count)} on={config.color} />
              </div>
              <div
                className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]`}
              >
                {config.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
