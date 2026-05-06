import "server-only";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, count, eq, gt, inArray, lt, or } from "drizzle-orm";

export type PrMetric = "distance" | "ascent" | "movingTime";

export type PrBadge = {
  rank: 1 | 2 | 3;
  metric: PrMetric;
  label: string;
};

type LabelTuple = readonly [string, string, string];

type SportGroupConfig = {
  types: readonly string[];
  distance: LabelTuple;
  ascent: LabelTuple;
  movingTime: LabelTuple;
};

const SPORT_GROUPS: Record<string, SportGroupConfig> = {
  cycling: {
    types: ["CYCLING", "ROAD_BIKING", "MOUNTAIN_BIKING"],
    distance: [
      "Längste Radfahrt",
      "Zweitlängste Radfahrt",
      "Drittlängste Radfahrt",
    ],
    ascent: [
      "Höchster Anstieg (Rad)",
      "Zweithöchster Anstieg (Rad)",
      "Dritthöchster Anstieg (Rad)",
    ],
    movingTime: [
      "Längste Fahrzeit",
      "Zweitlängste Fahrzeit",
      "Drittlängste Fahrzeit",
    ],
  },
  running: {
    types: ["RUNNING"],
    distance: ["Längster Lauf", "Zweitlängster Lauf", "Drittlängster Lauf"],
    ascent: [
      "Höchster Anstieg (Lauf)",
      "Zweithöchster Anstieg (Lauf)",
      "Dritthöchster Anstieg (Lauf)",
    ],
    movingTime: ["Längste Laufzeit", "Zweitlängste Laufzeit", "Drittlängste Laufzeit"],
  },
  hiking: {
    types: ["HIKING"],
    distance: [
      "Längste Wanderung",
      "Zweitlängste Wanderung",
      "Drittlängste Wanderung",
    ],
    ascent: [
      "Höchster Anstieg (Wanderung)",
      "Zweithöchster Anstieg (Wanderung)",
      "Dritthöchster Anstieg (Wanderung)",
    ],
    movingTime: [
      "Längste Wanderzeit",
      "Zweitlängste Wanderzeit",
      "Drittlängste Wanderzeit",
    ],
  },
  walking: {
    types: ["WALKING"],
    distance: [
      "Längster Spaziergang",
      "Zweitlängster Spaziergang",
      "Drittlängster Spaziergang",
    ],
    ascent: [
      "Höchster Anstieg (Spaziergang)",
      "Zweithöchster Anstieg (Spaziergang)",
      "Dritthöchster Anstieg (Spaziergang)",
    ],
    movingTime: [
      "Längste Geh-Zeit",
      "Zweitlängste Geh-Zeit",
      "Drittlängste Geh-Zeit",
    ],
  },
  swimming: {
    types: ["SWIMMING"],
    distance: [
      "Längstes Schwimmen",
      "Zweitlängstes Schwimmen",
      "Drittlängstes Schwimmen",
    ],
    ascent: [
      "Höchster Anstieg (Schwimmen)",
      "Zweithöchster Anstieg (Schwimmen)",
      "Dritthöchster Anstieg (Schwimmen)",
    ],
    movingTime: [
      "Längste Schwimmzeit",
      "Zweitlängste Schwimmzeit",
      "Drittlängste Schwimmzeit",
    ],
  },
};

const MIN_GROUP_SIZE = 3;

function findSportGroup(type: string): SportGroupConfig | null {
  const t = type.toUpperCase();
  for (const group of Object.values(SPORT_GROUPS)) {
    if (group.types.includes(t)) return group;
  }
  return null;
}

export async function getActivityPersonalBests(
  userId: string,
  activityId: string
): Promise<PrBadge[]> {
  const [current] = await db
    .select({
      userId: activities.userId,
      type: activities.type,
      startTime: activities.startTime,
      distance: activities.distance,
      ascent: activities.ascent,
      movingTime: activities.movingTime,
    })
    .from(activities)
    .where(eq(activities.id, activityId))
    .limit(1);

  if (!current) return [];
  if (current.userId !== userId) return [];

  const group = findSportGroup(current.type);
  if (!group) return [];

  const groupTypes = [...group.types];

  const [totalRow] = await db
    .select({ n: count() })
    .from(activities)
    .where(
      and(eq(activities.userId, userId), inArray(activities.type, groupTypes))
    );
  const total = totalRow?.n ?? 0;
  if (total < MIN_GROUP_SIZE) return [];

  const computeBadge = async (
    metric: PrMetric,
    value: number | null,
    labels: LabelTuple
  ): Promise<PrBadge | null> => {
    if (value == null) return null;
    const column =
      metric === "distance"
        ? activities.distance
        : metric === "ascent"
          ? activities.ascent
          : activities.movingTime;
    const [row] = await db
      .select({ better: count() })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          inArray(activities.type, groupTypes),
          or(
            gt(column, value),
            and(eq(column, value), lt(activities.startTime, current.startTime))
          )
        )
      );
    const better = row?.better ?? 0;
    const rank = better + 1;
    if (rank < 1 || rank > 3) return null;
    return {
      rank: rank as 1 | 2 | 3,
      metric,
      label: labels[rank - 1],
    };
  };

  const badges = await Promise.all([
    computeBadge("distance", current.distance, group.distance),
    computeBadge("ascent", current.ascent, group.ascent),
    computeBadge("movingTime", current.movingTime, group.movingTime),
  ]);

  return badges.filter((b): b is PrBadge => b !== null);
}
