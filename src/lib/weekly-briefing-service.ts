import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, weeklyBriefings } from "@/lib/db/schema";
import { buildCoachContext, type CoachContext } from "./coach-context";
import {
  buildWeeklyRecap,
  previousWeekStart,
  startOfIsoWeek,
  toIsoWeekKey,
  type WeeklyRecap,
} from "./weekly-recap";
import {
  WeeklyBriefingSchema,
  generateWeeklyBriefing,
  type WeeklyBriefing,
} from "./weekly-briefing-prompt";
import { DEFAULT_MODEL } from "./openai";

export interface WeeklyBriefingRecord {
  id: string;
  userId: string;
  isoWeek: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: Date;
  seenAt: Date | null;
  model: string;
  recap: WeeklyRecap;
  briefing: WeeklyBriefing;
}

function rowToRecord(row: typeof weeklyBriefings.$inferSelect): WeeklyBriefingRecord {
  const briefing: WeeklyBriefing = {
    summary: row.summary,
    highlights: (row.highlights as WeeklyBriefing["highlights"]) ?? [],
    warnings: (row.warnings as WeeklyBriefing["warnings"]) ?? [],
    suggestions: (row.suggestions as WeeklyBriefing["suggestions"]) ?? [],
  };
  return {
    id: row.id,
    userId: row.userId,
    isoWeek: row.isoWeek,
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    generatedAt: row.generatedAt,
    seenAt: row.seenAt,
    model: row.model,
    recap: row.recap as WeeklyRecap,
    briefing,
  };
}

/**
 * Return the most recent stored briefing for a user, or null.
 */
export async function getLatestWeeklyBriefing(
  userId: string
): Promise<WeeklyBriefingRecord | null> {
  const rows = await db
    .select()
    .from(weeklyBriefings)
    .where(eq(weeklyBriefings.userId, userId))
    .orderBy(desc(weeklyBriefings.weekStart))
    .limit(1);
  if (rows.length === 0) return null;
  return rowToRecord(rows[0]);
}

export async function getWeeklyBriefing(
  userId: string,
  isoWeek: string
): Promise<WeeklyBriefingRecord | null> {
  const rows = await db
    .select()
    .from(weeklyBriefings)
    .where(
      and(
        eq(weeklyBriefings.userId, userId),
        eq(weeklyBriefings.isoWeek, isoWeek)
      )
    )
    .limit(1);
  if (rows.length === 0) return null;
  return rowToRecord(rows[0]);
}

/**
 * Mark the user's latest briefing for `isoWeek` as seen. Idempotent —
 * re-running later does not overwrite the first seen timestamp.
 */
export async function markBriefingSeen(
  userId: string,
  isoWeek: string,
  seenAt: Date = new Date()
): Promise<void> {
  await db
    .update(weeklyBriefings)
    .set({ seenAt })
    .where(
      and(
        eq(weeklyBriefings.userId, userId),
        eq(weeklyBriefings.isoWeek, isoWeek),
        sql`${weeklyBriefings.seenAt} IS NULL`
      )
    );
}

export interface GenerateOptions {
  /**
   * Start-date of the recap week (Monday 00:00). Defaults to the previous
   * ISO week — this is the week the Sunday-evening cron recaps.
   */
  weekStart?: Date;
  /**
   * When a briefing already exists for the week, skip generation and return
   * the existing record. `false` regenerates and overwrites. Default: true
   * (per product decision — cron re-runs preserve the first briefing).
   */
  preserveExisting?: boolean;
}

/**
 * Generate (or reuse) a weekly briefing for a user.
 *
 * Flow:
 * 1. Resolve the target week (default: the week that just ended).
 * 2. If a row for (userId, isoWeek) already exists and `preserveExisting`
 *    is true → return it untouched.
 * 3. Otherwise build recap + coach-context, ask the LLM, upsert the row,
 *    and return the resulting record.
 */
export async function generateWeeklyBriefingForUser(
  userId: string,
  opts: GenerateOptions = {}
): Promise<WeeklyBriefingRecord> {
  const weekStart = opts.weekStart
    ? startOfIsoWeek(opts.weekStart)
    : previousWeekStart();
  const isoWeek = toIsoWeekKey(weekStart);

  if (opts.preserveExisting ?? true) {
    const existing = await getWeeklyBriefing(userId, isoWeek);
    if (existing) return existing;
  }

  const [recap, ctx] = await Promise.all([
    buildWeeklyRecap(userId, weekStart),
    buildCoachContext(userId),
  ]);

  const briefing = await generateWeeklyBriefing(ctx, recap);
  // defensive — schema parse also covers missing fields in dev:
  WeeklyBriefingSchema.parse(briefing);

  const [row] = await db
    .insert(weeklyBriefings)
    .values({
      userId,
      isoWeek,
      weekStart: recap.weekStart,
      weekEnd: recap.weekEnd,
      model: DEFAULT_MODEL,
      recap,
      summary: briefing.summary,
      highlights: briefing.highlights,
      warnings: briefing.warnings,
      suggestions: briefing.suggestions,
    })
    .onConflictDoUpdate({
      target: [weeklyBriefings.userId, weeklyBriefings.isoWeek],
      set: {
        generatedAt: new Date(),
        model: DEFAULT_MODEL,
        recap,
        summary: briefing.summary,
        highlights: briefing.highlights,
        warnings: briefing.warnings,
        suggestions: briefing.suggestions,
        // seenAt stays where it was — we don't reset it on regenerate.
      },
    })
    .returning();

  return rowToRecord(row);
}

export interface CronRunResult {
  weekStart: string;
  isoWeek: string;
  processed: number;
  generated: number;
  reused: number;
  failed: Array<{ userId: string; error: string }>;
  pushedTo: number;
}

export type PushSender = (
  userId: string,
  record: WeeklyBriefingRecord,
  context: CoachContext
) => Promise<boolean>;

/**
 * Iterate over all users and produce a briefing for the week that just
 * ended. Failures per user are captured but do not abort the loop.
 * The push sender is injected so the service stays testable — pass
 * `sendBriefingPush` from the API route.
 */
export async function runWeeklyBriefingCron(
  options: { pushSender?: PushSender; now?: Date } = {}
): Promise<CronRunResult> {
  const now = options.now ?? new Date();
  const weekStart = previousWeekStart(now);
  const isoWeek = toIsoWeekKey(weekStart);

  const result: CronRunResult = {
    weekStart: toDateKey(weekStart),
    isoWeek,
    processed: 0,
    generated: 0,
    reused: 0,
    failed: [],
    pushedTo: 0,
  };

  const userRows = await db.select({ id: users.id }).from(users);

  for (const { id: userId } of userRows) {
    result.processed += 1;
    try {
      const existing = await getWeeklyBriefing(userId, isoWeek);
      const record =
        existing ??
        (await generateWeeklyBriefingForUser(userId, {
          weekStart,
          preserveExisting: true,
        }));
      if (existing) result.reused += 1;
      else result.generated += 1;

      if (options.pushSender) {
        const ctx = await buildCoachContext(userId, now);
        const delivered = await options.pushSender(userId, record, ctx);
        if (delivered) result.pushedTo += 1;
      }
    } catch (err) {
      console.error(`[weekly-briefing] user=${userId} failed:`, err);
      result.failed.push({
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}
