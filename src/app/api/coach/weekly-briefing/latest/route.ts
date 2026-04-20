import { auth } from "@/auth";
import { getLatestWeeklyBriefing } from "@/lib/weekly-briefing-service";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const record = await getLatestWeeklyBriefing(session.user.id);
  if (!record) return Response.json({ briefing: null });

  return Response.json({
    briefing: {
      id: record.id,
      isoWeek: record.isoWeek,
      weekStart: record.weekStart,
      weekEnd: record.weekEnd,
      generatedAt: record.generatedAt.toISOString(),
      seenAt: record.seenAt?.toISOString() ?? null,
      model: record.model,
      recap: record.recap,
      summary: record.briefing.summary,
      highlights: record.briefing.highlights,
      warnings: record.briefing.warnings,
      suggestions: record.briefing.suggestions,
    },
  });
}
