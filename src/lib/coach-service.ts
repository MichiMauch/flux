import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { coachSuggestions } from "@/lib/db/schema";
import { buildCoachContext, computeContextHash, type CoachContext } from "./coach-context";
import {
  CoachSuggestionsSchema,
  generateCoachSuggestions,
  type CoachSuggestions,
} from "./coach-prompt";
import { DEFAULT_MODEL } from "./openai";

export interface CoachResult {
  suggestions: CoachSuggestions;
  context: CoachContext;
  contextHash: string;
  generatedAt: Date;
  model: string;
  cached: boolean;
}

/**
 * Load or generate coach suggestions for a user. Caches by `contextHash`,
 * so identical training state returns the same answer without hitting the
 * LLM. On LLM failure it falls back to the latest cached row.
 *
 * @param force  When true, always generate a fresh answer and insert it
 *               (even if an identical contextHash already exists).
 */
export async function getOrGenerateSuggestions(
  userId: string,
  force = false
): Promise<CoachResult> {
  const ctx = await buildCoachContext(userId);
  const contextHash = computeContextHash(ctx);

  if (!force) {
    const hit = await db
      .select()
      .from(coachSuggestions)
      .where(
        and(
          eq(coachSuggestions.userId, userId),
          eq(coachSuggestions.contextHash, contextHash)
        )
      )
      .orderBy(desc(coachSuggestions.generatedAt))
      .limit(1);
    if (hit.length > 0) {
      const row = hit[0];
      const parsed = CoachSuggestionsSchema.safeParse(row.suggestions);
      if (parsed.success) {
        return {
          suggestions: parsed.data,
          context: ctx,
          contextHash,
          generatedAt: row.generatedAt,
          model: row.model,
          cached: true,
        };
      }
      // stale/invalid cache row — fall through and regenerate
    }
  }

  try {
    const suggestions = await generateCoachSuggestions(ctx);
    const [inserted] = await db
      .insert(coachSuggestions)
      .values({
        userId,
        contextHash,
        model: DEFAULT_MODEL,
        context: ctx,
        suggestions,
      })
      .returning({ generatedAt: coachSuggestions.generatedAt });
    return {
      suggestions,
      context: ctx,
      contextHash,
      generatedAt: inserted.generatedAt,
      model: DEFAULT_MODEL,
      cached: false,
    };
  } catch (err) {
    console.error("[coach] LLM generation failed:", err);
    // Fallback: return latest known-good cache row for this user.
    const fallback = await db
      .select()
      .from(coachSuggestions)
      .where(eq(coachSuggestions.userId, userId))
      .orderBy(desc(coachSuggestions.generatedAt))
      .limit(1);
    if (fallback.length > 0) {
      const row = fallback[0];
      const parsed = CoachSuggestionsSchema.safeParse(row.suggestions);
      if (parsed.success) {
        return {
          suggestions: parsed.data,
          context: ctx,
          contextHash: row.contextHash,
          generatedAt: row.generatedAt,
          model: row.model,
          cached: true,
        };
      }
    }
    throw err;
  }
}
