import { BentoTile } from "../bento/bento-tile";
import { spaceMono } from "../bento/bento-fonts";
import { getLatestWeeklyBriefing } from "@/lib/weekly-briefing-service";
import {
  WeeklyBriefingCard,
  type WeeklyBriefingCardData,
} from "./weekly-briefing-card";

export async function WeeklyBriefingSection({ userId }: { userId: string }) {
  // Nur das Laden steht im try: Render-Fehler der Kinder fängt ein try/catch
  // ohnehin nicht ab, dafür wären Error Boundaries zuständig.
  let record: Awaited<ReturnType<typeof getLatestWeeklyBriefing>>;
  try {
    record = await getLatestWeeklyBriefing(userId);
  } catch (err) {
    console.error("[WeeklyBriefingSection] error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return <ErrorState message={msg} />;
  }

  if (!record) {
    return (
      <BentoTile label="Coach" title="Wochen-Briefing">
        <EmptyState />
      </BentoTile>
    );
  }

  const data: WeeklyBriefingCardData = {
    isoWeek: record.isoWeek,
    weekStart: record.weekStart,
    weekEnd: record.weekEnd,
    summary: record.briefing.summary,
    highlights: record.briefing.highlights,
    warnings: record.briefing.warnings,
    suggestions: record.briefing.suggestions,
    recap: record.recap,
    generatedAt: record.generatedAt.toISOString(),
  };

  return (
    <BentoTile label="Coach" title="Wochen-Briefing">
      <WeeklyBriefingCard data={data} />
    </BentoTile>
  );
}

function ErrorState({ message }: { message: string }) {
  const isDev = process.env.NODE_ENV !== "production";
  return (
    <BentoTile label="Coach" title="Wochen-Briefing">
      <div
        className={`${spaceMono.className} text-xs text-[#a3a3a3] py-6 text-center`}
      >
        Konnte das Briefing gerade nicht laden.
        {isDev && (
          <pre className="mt-3 text-left text-[10px] text-[#EF4444] whitespace-pre-wrap">
            {message}
          </pre>
        )}
      </div>
    </BentoTile>
  );
}

function EmptyState() {
  return (
    <div
      className={`${spaceMono.className} text-xs text-[#a3a3a3] py-6 text-center`}
    >
      Das nächste Wochen-Briefing erscheint Sonntagabend. Oder generiere es
      manuell mit <code className="text-white">POST /api/coach/weekly-briefing/generate</code>.
    </div>
  );
}
