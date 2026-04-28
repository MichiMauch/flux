/**
 * POST /api/cron/weekly-briefing
 *
 * Called by Coolify Scheduled Task every Sunday 18:00 local time.
 * Auth: `Authorization: Bearer $CRON_SECRET` (same secret must live in
 * the CRON_SECRET env var).
 *
 * Iterates every user, reuses an existing briefing for the just-ended
 * ISO week if one exists, otherwise generates + stores a fresh one,
 * and delivers a push notification to each user with subscriptions.
 */

import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendPushToUser } from "@/lib/push";
import {
  runWeeklyBriefingCron,
  type PushSender,
} from "@/lib/weekly-briefing-service";

export const runtime = "nodejs";
// Cron work is user-synchronous and can exceed the default 10s serverless
// cap; pick a generous ceiling. Vercel would cap this anyway, but Coolify
// runs on our own box.
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const provided = match[1];
  if (provided.length !== secret.length) return false;

  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

const pushSender: PushSender = async (userId, record) => {
  const weekNum = record.isoWeek.split("-")[1] ?? record.isoWeek;
  try {
    await sendPushToUser(userId, {
      title: `Dein Wochen-Briefing KW ${weekNum}`,
      body: "Rückblick auf die Woche und dein Plan für die nächsten 7 Tage.",
      url: "/training-load",
      tag: `weekly-briefing-${record.isoWeek}`,
      kind: "weekly_briefing",
    });
    return true;
  } catch (err) {
    console.error(`[cron/weekly-briefing] push failed user=${userId}:`, err);
    return false;
  }
};

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWeeklyBriefingCron({ pushSender });
    return Response.json(result);
  } catch (err) {
    console.error("[cron/weekly-briefing] fatal:", err);
    return Response.json(
      {
        error: "Cron run failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
