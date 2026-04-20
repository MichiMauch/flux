import { BentoTile } from "../bento/bento-tile";
import { spaceMono } from "../bento/bento-fonts";
import { getOrGenerateSuggestions } from "@/lib/coach-service";
import { CoachSuggestionList } from "./coach-suggestion-list";

/**
 * Self-contained Coach section. Drop this anywhere with a userId.
 * It fetches (or regenerates) its own data and renders the Bento tile.
 */
export async function CoachSuggestionsSection({ userId }: { userId: string }) {
  try {
    const result = await getOrGenerateSuggestions(userId, false);
    const hasEnoughData = result.context.recentActivities.length >= 1;

    return (
      <BentoTile label="Coach" title="Vorschläge für die nächsten Tage">
        {hasEnoughData ? (
          <CoachSuggestionList
            initial={{
              suggestions: result.suggestions,
              generatedAt: result.generatedAt.toISOString(),
              model: result.model,
              cached: result.cached,
            }}
          />
        ) : (
          <EmptyState />
        )}
      </BentoTile>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[CoachSuggestionsSection] error:", message);
    if (stack) console.error(stack);
    const isDev = process.env.NODE_ENV !== "production";
    return (
      <BentoTile label="Coach" title="Vorschläge">
        <div
          className={`${spaceMono.className} text-xs text-[#a3a3a3] py-6 text-center`}
        >
          Der Coach ist gerade nicht erreichbar. Probier es später nochmal.
          {isDev && (
            <pre className="mt-3 text-left text-[10px] text-[#EF4444] whitespace-pre-wrap">
              {message}
            </pre>
          )}
        </div>
      </BentoTile>
    );
  }
}

function EmptyState() {
  return (
    <div
      className={`${spaceMono.className} text-xs text-[#a3a3a3] py-6 text-center`}
    >
      Logge ein paar Trainings, dann bekommst du hier konkrete Vorschläge.
    </div>
  );
}
