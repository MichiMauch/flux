/**
 * Vercel AI SDK v6 tools for natural-language activity search.
 *
 * Each tool is user-scoped via a closure over `userId` so the model can never
 * query other users' activities.
 */

import type { ToolSet } from "ai";
import { z } from "zod";
import { and, asc, desc, eq, gte, ilike, lte, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";

type CompactActivity = {
  id: string;
  name: string;
  type: string;
  startTime: string;
  distanceKm: number | null;
  durationMin: number | null;
  ascentM: number | null;
  trimp: number | null;
};

function toCompact(row: {
  id: string;
  name: string;
  type: string;
  startTime: Date;
  distance: number | null;
  duration: number | null;
  movingTime: number | null;
  ascent: number | null;
  trimp: number | null;
}): CompactActivity {
  const seconds = row.movingTime ?? row.duration;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    startTime: row.startTime.toISOString(),
    distanceKm:
      row.distance != null ? Math.round((row.distance / 1000) * 100) / 100 : null,
    durationMin: seconds != null ? Math.round(seconds / 60) : null,
    ascentM: row.ascent != null ? Math.round(row.ascent) : null,
    trimp: row.trimp != null ? Math.round(row.trimp) : null,
  };
}

export function getSearchTools(userId: string): ToolSet {
  return {
    list_activities: {
      description:
        "Liefere eine kompakte Übersicht (bis zu 200 Einträge) aller Aktivitäten des Users, absteigend sortiert nach Startzeit. Nutze dies für einen ersten Überblick, bevor du gezielt filterst.",
      inputSchema: z.object({}),
      execute: async (): Promise<{ activities: CompactActivity[]; total: number }> => {
        const rows = await db
          .select({
            id: activities.id,
            name: activities.name,
            type: activities.type,
            startTime: activities.startTime,
            distance: activities.distance,
            duration: activities.duration,
            movingTime: activities.movingTime,
            ascent: activities.ascent,
            trimp: activities.trimp,
          })
          .from(activities)
          .where(eq(activities.userId, userId))
          .orderBy(desc(activities.startTime))
          .limit(200);

        const compact = rows.map(toCompact);
        return { activities: compact, total: compact.length };
      },
    },

    search_activities: {
      description:
        "Filtere und sortiere Aktivitäten des Users. Alle Parameter sind optional. nameContains prüft Teilstring (case-insensitive) im Titel. dateFrom/dateTo sind ISO-Datumsstrings. orderBy akzeptiert: distance, duration, ascent, startTime, trimp. Maximales Limit: 100.",
      inputSchema: z.object({
        type: z
          .string()
          .optional()
          .describe(
            "Aktivitätstyp, z.B. RUNNING, CYCLING, HIKING, WALKING, SWIMMING."
          ),
        nameContains: z
          .string()
          .optional()
          .describe("Teilstring im Aktivitätstitel (ILIKE)."),
        dateFrom: z
          .string()
          .optional()
          .describe("ISO-Datum, nur Aktivitäten ab diesem Zeitpunkt."),
        dateTo: z
          .string()
          .optional()
          .describe("ISO-Datum, nur Aktivitäten bis zu diesem Zeitpunkt."),
        minDistanceKm: z.number().optional(),
        maxDistanceKm: z.number().optional(),
        orderBy: z
          .enum(["distance", "duration", "ascent", "startTime", "trimp"])
          .optional()
          .default("startTime"),
        orderDir: z.enum(["asc", "desc"]).optional().default("desc"),
        limit: z.number().int().min(1).max(100).optional().default(20),
      }),
      execute: async (args: {
        type?: string;
        nameContains?: string;
        dateFrom?: string;
        dateTo?: string;
        minDistanceKm?: number;
        maxDistanceKm?: number;
        orderBy?: "distance" | "duration" | "ascent" | "startTime" | "trimp";
        orderDir?: "asc" | "desc";
        limit?: number;
      }): Promise<{ activities: CompactActivity[]; total: number }> => {
        const conditions: SQL[] = [eq(activities.userId, userId)];

        if (args.type) {
          conditions.push(eq(activities.type, args.type.toUpperCase()));
        }
        if (args.nameContains) {
          conditions.push(ilike(activities.name, `%${args.nameContains}%`));
        }
        if (args.dateFrom) {
          const d = new Date(args.dateFrom);
          if (!isNaN(d.getTime())) conditions.push(gte(activities.startTime, d));
        }
        if (args.dateTo) {
          const d = new Date(args.dateTo);
          if (!isNaN(d.getTime())) conditions.push(lte(activities.startTime, d));
        }
        if (args.minDistanceKm != null) {
          conditions.push(gte(activities.distance, args.minDistanceKm * 1000));
        }
        if (args.maxDistanceKm != null) {
          conditions.push(lte(activities.distance, args.maxDistanceKm * 1000));
        }

        const orderCol =
          args.orderBy === "distance"
            ? activities.distance
            : args.orderBy === "duration"
            ? activities.duration
            : args.orderBy === "ascent"
            ? activities.ascent
            : args.orderBy === "trimp"
            ? activities.trimp
            : activities.startTime;

        const dir = args.orderDir ?? "desc";
        const limit = Math.min(args.limit ?? 20, 100);

        const rows = await db
          .select({
            id: activities.id,
            name: activities.name,
            type: activities.type,
            startTime: activities.startTime,
            distance: activities.distance,
            duration: activities.duration,
            movingTime: activities.movingTime,
            ascent: activities.ascent,
            trimp: activities.trimp,
          })
          .from(activities)
          .where(and(...conditions))
          .orderBy(dir === "asc" ? asc(orderCol) : desc(orderCol))
          .limit(limit);

        const compact = rows.map(toCompact);
        return { activities: compact, total: compact.length };
      },
    },

    get_activity: {
      description:
        "Lade die vollständigen Details einer einzelnen Aktivität (inkl. Notizen, Herzfrequenz, Kalorien, TRIMP) anhand ihrer UUID.",
      inputSchema: z.object({
        id: z.string().describe("UUID der Aktivität."),
      }),
      execute: async ({ id }: { id: string }) => {
        const rows = await db
          .select({
            id: activities.id,
            name: activities.name,
            type: activities.type,
            startTime: activities.startTime,
            duration: activities.duration,
            movingTime: activities.movingTime,
            distance: activities.distance,
            ascent: activities.ascent,
            descent: activities.descent,
            avgHeartRate: activities.avgHeartRate,
            maxHeartRate: activities.maxHeartRate,
            trimp: activities.trimp,
            calories: activities.calories,
            notes: activities.notes,
          })
          .from(activities)
          .where(and(eq(activities.id, id), eq(activities.userId, userId)))
          .limit(1);

        if (rows.length === 0) {
          return { found: false as const };
        }

        const a = rows[0];
        return {
          found: true as const,
          activity: {
            id: a.id,
            name: a.name,
            type: a.type,
            startTime: a.startTime.toISOString(),
            durationMin: a.duration != null ? Math.round(a.duration / 60) : null,
            movingTimeMin:
              a.movingTime != null ? Math.round(a.movingTime / 60) : null,
            distanceKm:
              a.distance != null
                ? Math.round((a.distance / 1000) * 100) / 100
                : null,
            ascentM: a.ascent != null ? Math.round(a.ascent) : null,
            descentM: a.descent != null ? Math.round(a.descent) : null,
            avgHeartRate: a.avgHeartRate,
            maxHeartRate: a.maxHeartRate,
            trimp: a.trimp != null ? Math.round(a.trimp) : null,
            calories: a.calories,
            notes: a.notes,
          },
        };
      },
    },
  } as ToolSet;
}
