import type { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { markBriefingSeen } from "@/lib/weekly-briefing-service";

export const runtime = "nodejs";

const bodySchema = z.object({
  isoWeek: z.string().regex(/^\d{4}-\d{2}$/, "isoWeek must match YYYY-WW"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  await markBriefingSeen(session.user.id, parsed.data.isoWeek);
  return Response.json({ ok: true });
}
