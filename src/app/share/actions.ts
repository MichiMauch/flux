"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities, activityTours } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

function newToken(): string {
  return randomBytes(18).toString("base64url");
}

function revalidateActivitySharePaths(
  activityId: string,
  prevToken: string | null,
  nextToken: string | null
) {
  revalidatePath(`/activity/${activityId}`);
  if (prevToken) revalidatePath(`/share/activity/${prevToken}`);
  if (nextToken && nextToken !== prevToken) {
    revalidatePath(`/share/activity/${nextToken}`);
  }
}

function revalidateTourSharePaths(
  tourId: string,
  prevToken: string | null,
  nextToken: string | null
) {
  revalidatePath(`/tours/${tourId}`);
  if (prevToken) revalidatePath(`/share/tour/${prevToken}`);
  if (nextToken && nextToken !== prevToken) {
    revalidatePath(`/share/tour/${nextToken}`);
  }
}

async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  return id;
}

export async function setActivityShare(
  activityId: string,
  enable: boolean
): Promise<string | null> {
  const userId = await requireUserId();

  const rows = await db
    .select({ id: activities.id, shareToken: activities.shareToken })
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new Error("Aktivität nicht gefunden");

  const prevToken = rows[0].shareToken;
  let token: string | null;
  if (enable) {
    token = prevToken ?? newToken();
    if (!prevToken) {
      await db
        .update(activities)
        .set({ shareToken: token })
        .where(eq(activities.id, activityId));
    }
  } else {
    token = null;
    await db
      .update(activities)
      .set({ shareToken: null })
      .where(eq(activities.id, activityId));
  }

  revalidateActivitySharePaths(activityId, prevToken, token);
  return token;
}

export async function rotateActivityShare(
  activityId: string
): Promise<string> {
  const userId = await requireUserId();

  const rows = await db
    .select({ id: activities.id, shareToken: activities.shareToken })
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new Error("Aktivität nicht gefunden");

  const prevToken = rows[0].shareToken;
  const token = newToken();
  await db
    .update(activities)
    .set({ shareToken: token })
    .where(eq(activities.id, activityId));

  revalidateActivitySharePaths(activityId, prevToken, token);
  return token;
}

export async function setTourShare(
  tourId: string,
  enable: boolean
): Promise<string | null> {
  const userId = await requireUserId();

  const rows = await db
    .select({ id: activityTours.id, shareToken: activityTours.shareToken })
    .from(activityTours)
    .where(
      and(eq(activityTours.id, tourId), eq(activityTours.userId, userId))
    )
    .limit(1);
  if (rows.length === 0) throw new Error("Tour nicht gefunden");

  const prevToken = rows[0].shareToken;
  let token: string | null;
  if (enable) {
    token = prevToken ?? newToken();
    if (!prevToken) {
      await db
        .update(activityTours)
        .set({ shareToken: token, updatedAt: new Date() })
        .where(eq(activityTours.id, tourId));
    }
  } else {
    token = null;
    await db
      .update(activityTours)
      .set({ shareToken: null, updatedAt: new Date() })
      .where(eq(activityTours.id, tourId));
  }

  revalidateTourSharePaths(tourId, prevToken, token);
  return token;
}

export async function rotateTourShare(tourId: string): Promise<string> {
  const userId = await requireUserId();

  const rows = await db
    .select({ id: activityTours.id, shareToken: activityTours.shareToken })
    .from(activityTours)
    .where(
      and(eq(activityTours.id, tourId), eq(activityTours.userId, userId))
    )
    .limit(1);
  if (rows.length === 0) throw new Error("Tour nicht gefunden");

  const prevToken = rows[0].shareToken;
  const token = newToken();
  await db
    .update(activityTours)
    .set({ shareToken: token, updatedAt: new Date() })
    .where(eq(activityTours.id, tourId));

  revalidateTourSharePaths(tourId, prevToken, token);
  return token;
}
