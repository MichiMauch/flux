/**
 * GET  /api/coach/suggestions          → cached or freshly generated
 * POST /api/coach/suggestions[?force=1] → force regeneration (refresh button)
 */

import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getOrGenerateSuggestions } from "@/lib/coach-service";

export const runtime = "nodejs";

async function handle(force: boolean) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await getOrGenerateSuggestions(session.user.id, force);
    return Response.json({
      suggestions: result.suggestions,
      generatedAt: result.generatedAt.toISOString(),
      model: result.model,
      cached: result.cached,
      contextHash: result.contextHash,
    });
  } catch (err) {
    console.error("[/api/coach/suggestions] fatal:", err);
    return Response.json(
      { error: "Coach generation failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return handle(false);
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") !== null;
  return handle(force);
}
