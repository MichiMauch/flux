/**
 * Dev/manual trigger — generates the briefing for the current user for the
 * previous ISO week. When a briefing already exists, it is returned as-is
 * (preserveExisting = true). Pass `?force=1` to regenerate.
 */

import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { generateWeeklyBriefingForUser } from "@/lib/weekly-briefing-service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") !== null;

  try {
    const record = await generateWeeklyBriefingForUser(session.user.id, {
      preserveExisting: !force,
    });
    return Response.json({
      briefing: {
        id: record.id,
        isoWeek: record.isoWeek,
        weekStart: record.weekStart,
        weekEnd: record.weekEnd,
        generatedAt: record.generatedAt.toISOString(),
        model: record.model,
      },
    });
  } catch (err) {
    console.error("[weekly-briefing/generate] fatal:", err);
    return Response.json(
      {
        error: "Briefing generation failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
