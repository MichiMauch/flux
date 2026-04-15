export type TrophyTier = "bronze" | "silber" | "gold" | null;

export type TrophyCategory =
  | "single"
  | "lifetime_distance"
  | "lifetime_ascent"
  | "lifetime_count"
  | "lifetime_duration"
  | "streak"
  | "special";

export type Criterion =
  | {
      kind: "single_activity";
      metric: "distance_km" | "ascent_m" | "duration_h";
      threshold: number;
    }
  | { kind: "single_activity_time"; beforeHour?: number; afterHour?: number }
  | {
      kind: "lifetime_sum";
      metric: "distance_km" | "ascent_m" | "duration_h";
      threshold: number;
    }
  | { kind: "lifetime_count"; threshold: number }
  | { kind: "streak_days"; threshold: number }
  | { kind: "weekday_count"; weekday: number; threshold: number };

export interface TrophyDef {
  code: string;
  title: string;
  description: string;
  icon: string; // lucide name
  tier: TrophyTier;
  category: TrophyCategory;
  criterion: Criterion;
  xpReward: number;
}

export const TROPHIES: TrophyDef[] = [
  // Single activity
  {
    code: "century_rider",
    title: "Century Rider",
    description: "100 km in einer Aktivität",
    icon: "Bike",
    tier: null,
    category: "single",
    criterion: { kind: "single_activity", metric: "distance_km", threshold: 100 },
    xpReward: 200,
  },
  {
    code: "halbmarathon",
    title: "Halbmarathon",
    description: "21.1 km in einer Aktivität",
    icon: "Footprints",
    tier: null,
    category: "single",
    criterion: { kind: "single_activity", metric: "distance_km", threshold: 21.1 },
    xpReward: 150,
  },
  {
    code: "marathon",
    title: "Marathon",
    description: "42.2 km in einer Aktivität",
    icon: "Medal",
    tier: null,
    category: "single",
    criterion: { kind: "single_activity", metric: "distance_km", threshold: 42.2 },
    xpReward: 400,
  },
  {
    code: "alpinist",
    title: "Alpinist",
    description: "1500 Höhenmeter in einer Aktivität",
    icon: "Mountain",
    tier: null,
    category: "single",
    criterion: { kind: "single_activity", metric: "ascent_m", threshold: 1500 },
    xpReward: 200,
  },
  {
    code: "ultra",
    title: "Ultra",
    description: "Mehr als 6 Stunden in einer Aktivität",
    icon: "Clock",
    tier: null,
    category: "single",
    criterion: { kind: "single_activity", metric: "duration_h", threshold: 6 },
    xpReward: 300,
  },
  {
    code: "fruehaufsteher",
    title: "Frühaufsteher",
    description: "Aktivität gestartet vor 07:00",
    icon: "Sunrise",
    tier: null,
    category: "special",
    criterion: { kind: "single_activity_time", beforeHour: 7 },
    xpReward: 50,
  },
  {
    code: "nachtschicht",
    title: "Nachtschicht",
    description: "Aktivität gestartet nach 21:00",
    icon: "Moon",
    tier: null,
    category: "special",
    criterion: { kind: "single_activity_time", afterHour: 21 },
    xpReward: 50,
  },

  // Lifetime distance
  {
    code: "distance_bronze",
    title: "Distanz-Sammler (Bronze)",
    description: "500 km Gesamtdistanz",
    icon: "Route",
    tier: "bronze",
    category: "lifetime_distance",
    criterion: { kind: "lifetime_sum", metric: "distance_km", threshold: 500 },
    xpReward: 100,
  },
  {
    code: "distance_silber",
    title: "Distanz-Sammler (Silber)",
    description: "2000 km Gesamtdistanz",
    icon: "Route",
    tier: "silber",
    category: "lifetime_distance",
    criterion: { kind: "lifetime_sum", metric: "distance_km", threshold: 2000 },
    xpReward: 300,
  },
  {
    code: "distance_gold",
    title: "Distanz-Sammler (Gold)",
    description: "5000 km Gesamtdistanz",
    icon: "Route",
    tier: "gold",
    category: "lifetime_distance",
    criterion: { kind: "lifetime_sum", metric: "distance_km", threshold: 5000 },
    xpReward: 800,
  },

  // Lifetime ascent
  {
    code: "ascent_bronze",
    title: "Höhensammler (Bronze)",
    description: "10 000 Höhenmeter gesamt",
    icon: "TrendingUp",
    tier: "bronze",
    category: "lifetime_ascent",
    criterion: { kind: "lifetime_sum", metric: "ascent_m", threshold: 10000 },
    xpReward: 100,
  },
  {
    code: "ascent_silber",
    title: "Höhensammler (Silber)",
    description: "50 000 Höhenmeter gesamt",
    icon: "TrendingUp",
    tier: "silber",
    category: "lifetime_ascent",
    criterion: { kind: "lifetime_sum", metric: "ascent_m", threshold: 50000 },
    xpReward: 300,
  },
  {
    code: "ascent_gold",
    title: "Höhensammler (Gold)",
    description: "100 000 Höhenmeter gesamt",
    icon: "TrendingUp",
    tier: "gold",
    category: "lifetime_ascent",
    criterion: { kind: "lifetime_sum", metric: "ascent_m", threshold: 100000 },
    xpReward: 800,
  },

  // Lifetime count
  {
    code: "count_bronze",
    title: "Vielstarter (Bronze)",
    description: "50 Aktivitäten",
    icon: "Activity",
    tier: "bronze",
    category: "lifetime_count",
    criterion: { kind: "lifetime_count", threshold: 50 },
    xpReward: 100,
  },
  {
    code: "count_silber",
    title: "Vielstarter (Silber)",
    description: "250 Aktivitäten",
    icon: "Activity",
    tier: "silber",
    category: "lifetime_count",
    criterion: { kind: "lifetime_count", threshold: 250 },
    xpReward: 300,
  },
  {
    code: "count_gold",
    title: "Vielstarter (Gold)",
    description: "1000 Aktivitäten",
    icon: "Activity",
    tier: "gold",
    category: "lifetime_count",
    criterion: { kind: "lifetime_count", threshold: 1000 },
    xpReward: 800,
  },

  // Lifetime duration
  {
    code: "duration_bronze",
    title: "Ausdauer (Bronze)",
    description: "50 Stunden Bewegungszeit",
    icon: "Hourglass",
    tier: "bronze",
    category: "lifetime_duration",
    criterion: { kind: "lifetime_sum", metric: "duration_h", threshold: 50 },
    xpReward: 100,
  },
  {
    code: "duration_silber",
    title: "Ausdauer (Silber)",
    description: "250 Stunden Bewegungszeit",
    icon: "Hourglass",
    tier: "silber",
    category: "lifetime_duration",
    criterion: { kind: "lifetime_sum", metric: "duration_h", threshold: 250 },
    xpReward: 300,
  },
  {
    code: "duration_gold",
    title: "Ausdauer (Gold)",
    description: "1000 Stunden Bewegungszeit",
    icon: "Hourglass",
    tier: "gold",
    category: "lifetime_duration",
    criterion: { kind: "lifetime_sum", metric: "duration_h", threshold: 1000 },
    xpReward: 800,
  },

  // Streaks
  {
    code: "streak_7",
    title: "Wochenstreak",
    description: "7 Tage in Folge aktiv",
    icon: "Flame",
    tier: null,
    category: "streak",
    criterion: { kind: "streak_days", threshold: 7 },
    xpReward: 150,
  },
  {
    code: "streak_30",
    title: "Monatsstreak",
    description: "30 Tage in Folge aktiv",
    icon: "Flame",
    tier: null,
    category: "streak",
    criterion: { kind: "streak_days", threshold: 30 },
    xpReward: 600,
  },

  // Weekday
  {
    code: "sonntagsheld",
    title: "Sonntagsheld",
    description: "10 Aktivitäten an Sonntagen",
    icon: "Sun",
    tier: null,
    category: "special",
    criterion: { kind: "weekday_count", weekday: 0, threshold: 10 },
    xpReward: 100,
  },
];

export function getTrophy(code: string): TrophyDef | undefined {
  return TROPHIES.find((t) => t.code === code);
}

// ── XP / Level ─────────────────────────────────────────────────────────────

export function activityXp(a: {
  distance: number | null;
  ascent: number | null;
  trimp: number | null;
}): number {
  const km = (a.distance ?? 0) / 1000;
  const hm = (a.ascent ?? 0) / 100;
  const trimpPart = (a.trimp ?? 0) / 10;
  return km + hm + trimpPart;
}

export function totalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 500 * (Math.pow(1.2, level - 1) - 1);
}

export function levelFromXp(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPct: number;
} {
  const safeXp = Math.max(0, xp);
  const level = Math.max(
    1,
    Math.floor(Math.log(safeXp / 500 + 1) / Math.log(1.2)) + 1
  );
  const currentLevelXp = totalXpForLevel(level);
  const nextLevelXp = totalXpForLevel(level + 1);
  const xpIntoLevel = safeXp - currentLevelXp;
  const xpForNextLevel = nextLevelXp - currentLevelXp;
  const progressPct =
    xpForNextLevel > 0 ? (xpIntoLevel / xpForNextLevel) * 100 : 0;
  return {
    level,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpForNextLevel,
    progressPct,
  };
}

export function formatXp(xp: number): string {
  return `${Math.round(xp).toLocaleString("de-CH")} XP`;
}

export function tierColor(tier: TrophyTier): string {
  switch (tier) {
    case "bronze":
      return "text-amber-700";
    case "silber":
      return "text-slate-500";
    case "gold":
      return "text-yellow-500";
    default:
      return "text-brand";
  }
}
