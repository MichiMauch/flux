import "server-only";
import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

let vapidConfigured = false;

function configureVapid(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) return null;

  if (!vapidConfigured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  }
  return { publicKey, privateKey, subject };
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const cfg = configureVapid();
  if (!cfg) {
    console.warn("[push] VAPID keys not configured — skipping");
    return;
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag,
    icon: payload.icon ?? "/icon-192.png",
  });

  const deadIds: string[] = [];
  const liveIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      const subscription: WebPushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(subscription, body);
        liveIds.push(sub.id);
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          deadIds.push(sub.id);
        } else {
          console.error(`[push] send failed (${statusCode ?? "?"}):`, err);
        }
      }
    })
  );

  if (deadIds.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, deadIds));
  }

  if (liveIds.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ lastUsedAt: new Date() })
      .where(inArray(pushSubscriptions.id, liveIds));
  }
}

export async function deleteSubscription(userId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(
      and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint))
    );
}
