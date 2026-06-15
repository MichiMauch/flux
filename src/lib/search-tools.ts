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
  durationMin: number | null; // Gesamt-/Bruttodauer (elapsed) — "wie lang war die Aktivität"
  movingMin: number | null; // reine Bewegungszeit (für Tempo)
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
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    startTime: row.startTime.toISOString(),
    distanceKm:
      row.distance != null ? Math.round((row.distance / 1000) * 100) / 100 : null,
    // "Wie lang war die Aktivität" = Gesamtdauer (elapsed). movingTime nur als
    // Zusatz — eine Wanderung mit Pausen ist brutto deutlich länger als die
    // Bewegungszeit, und genau das meinen User mit "7h lang".
    durationMin: row.duration != null ? Math.round(row.duration / 60) : null,
    movingMin: row.movingTime != null ? Math.round(row.movingTime / 60) : null,
    ascentM: row.ascent != null ? Math.round(row.ascent) : null,
    trimp: row.trimp != null ? Math.round(row.trimp) : null,
  };
}

export function getSearchTools(userId: string): ToolSet {
  return {
    list_activities: {
      description:
        "Liefert NUR die 200 NEUESTEN Aktivitäten (absteigend nach Startzeit) — also NICHT alle. Nutze dies ausschliesslich für 'was habe ich zuletzt / diesen Monat gemacht'. Verwende es NIE, um zu prüfen, ob eine bestimmte oder ältere Aktivität existiert, und ziehe daraus NIE den Schluss 'nicht gefunden' — ältere Aktivitäten (z.B. von 2018) fehlen hier. Für jede gezielte Suche nutze search_activities.",
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
        "Durchsucht ALLE Aktivitäten des Users — auch sehr alte (Jahre zurück, z.B. 2018). Das ist das richtige Tool, um bestimmte Aktivitäten zu finden: nach Typ (z.B. Wanderungen → HIKING), Name, Zeitraum (dateFrom/dateTo), Distanz oder Dauer. Alle Parameter sind optional. nameContains prüft Teilstring (case-insensitive) im Titel. dateFrom/dateTo sind ISO-Datumsstrings. minDurationMin/maxDurationMin filtern nach GESAMTDAUER in Minuten (z.B. 'über 7 Stunden' → minDurationMin=420) — das ist die Brutto-Zeit inkl. Pausen, nicht die Bewegungszeit. orderBy akzeptiert: distance, duration, ascent, startTime, trimp. Maximales Limit: 100. Bei einer Typ-/Zeitraum-/Dauer-Suche ohne ausdrücklichen Limit-Wunsch limit=100 setzen, damit auch ältere Treffer erscheinen.",
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
        minDurationMin: z
          .number()
          .optional()
          .describe("Mindest-Gesamtdauer in Minuten (elapsed, inkl. Pausen)."),
        maxDurationMin: z
          .number()
          .optional()
          .describe("Maximal-Gesamtdauer in Minuten (elapsed, inkl. Pausen)."),
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
        minDurationMin?: number;
        maxDurationMin?: number;
        orderBy?: "distance" | "duration" | "ascent" | "startTime" | "trimp";
        orderDir?: "asc" | "desc";
        limit?: number;
      }): Promise<{ activities: CompactActivity[]; total: number }> => {
        const conditions: SQL[] = [eq(activities.userId, userId)];

        if (args.type) {
          // Normalise common LLM/German variants to the stored enum values.
          const raw = args.type.toUpperCase().trim();
          const TYPE_ALIASES: Record<string, string> = {
            HIKE: "HIKING",
            WANDERUNG: "HIKING",
            WANDERN: "HIKING",
            WALK: "WALKING",
            SPAZIERGANG: "WALKING",
            GEHEN: "WALKING",
            RUN: "RUNNING",
            LAUF: "RUNNING",
            JOGGING: "RUNNING",
            BIKE: "CYCLING",
            VELO: "CYCLING",
            CYCLE: "CYCLING",
            RAD: "CYCLING",
            SWIM: "SWIMMING",
            SCHWIMMEN: "SWIMMING",
          };
          const t = TYPE_ALIASES[raw] ?? raw;
          if (t !== "ANY" && t !== "ALL" && t !== "") {
            conditions.push(eq(activities.type, t));
          }
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
        // WICHTIG: nur > 0 prüfen, nicht != null. Das LLM füllt optionale
        // Zahlen-Parameter gerne mit 0 statt sie wegzulassen — ein "max=0"
        // würde sonst zu "<= 0" und schliesst ALLE Aktivitäten aus.
        if (args.minDistanceKm != null && args.minDistanceKm > 0) {
          conditions.push(gte(activities.distance, args.minDistanceKm * 1000));
        }
        if (args.maxDistanceKm != null && args.maxDistanceKm > 0) {
          conditions.push(lte(activities.distance, args.maxDistanceKm * 1000));
        }
        // Gesamtdauer (elapsed) — das meinen User mit "X Stunden lang".
        if (args.minDurationMin != null && args.minDurationMin > 0) {
          conditions.push(gte(activities.duration, args.minDurationMin * 60));
        }
        if (args.maxDurationMin != null && args.maxDurationMin > 0) {
          conditions.push(lte(activities.duration, args.maxDurationMin * 60));
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
