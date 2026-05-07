"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  activities,
  activityTours,
  activityTourMembers,
} from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { unlink } from "fs/promises";
import { getTourCoverPath } from "@/lib/tour-covers";

const NAME_MAX = 120;
const DESC_MAX = 2000;

async function requireUserId() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  return id;
}

async function requireOwnedTour(userId: string, tourId: string) {
  const rows = await db
    .select({ id: activityTours.id })
    .from(activityTours)
    .where(
      and(eq(activityTours.id, tourId), eq(activityTours.userId, userId))
    )
    .limit(1);
  if (rows.length === 0) throw new Error("Tour not found");
}

function parseDate(v: FormDataEntryValue | null): Date | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseName(v: FormDataEntryValue | null): string {
  if (typeof v !== "string") throw new Error("Name fehlt");
  const trimmed = v.trim();
  if (trimmed.length === 0) throw new Error("Name darf nicht leer sein");
  if (trimmed.length > NAME_MAX) throw new Error("Name zu lang");
  return trimmed;
}

function parseDescription(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > DESC_MAX) throw new Error("Beschreibung zu lang");
  return trimmed;
}

export async function createTour(formData: FormData): Promise<string> {
  const userId = await requireUserId();

  const name = parseName(formData.get("name"));
  const description = parseDescription(formData.get("description"));
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));

  const [created] = await db
    .insert(activityTours)
    .values({ userId, name, description, startDate, endDate })
    .returning({ id: activityTours.id });

  revalidatePath("/tours");
  return created.id;
}

export async function updateTour(
  tourId: string,
  formData: FormData
): Promise<void> {
  const userId = await requireUserId();
  await requireOwnedTour(userId, tourId);

  const name = parseName(formData.get("name"));
  const description = parseDescription(formData.get("description"));
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));
  const sharedWithPartner = formData.get("sharedWithPartner") === "on";

  await db
    .update(activityTours)
    .set({
      name,
      description,
      startDate,
      endDate,
      sharedWithPartner,
      updatedAt: new Date(),
    })
    .where(eq(activityTours.id, tourId));

  revalidatePath("/tours");
  revalidatePath(`/tours/${tourId}`);
  revalidatePath(`/tours/${tourId}/edit`);
}

export async function deleteTour(tourId: string): Promise<void> {
  const userId = await requireUserId();
  await requireOwnedTour(userId, tourId);

  await db.delete(activityTours).where(eq(activityTours.id, tourId));
  await unlink(getTourCoverPath(tourId)).catch(() => {});

  revalidatePath("/tours");
}

export async function addActivitiesToTour(
  tourId: string,
  activityIds: string[]
): Promise<void> {
  const userId = await requireUserId();
  await requireOwnedTour(userId, tourId);

  if (activityIds.length === 0) return;

  const owned = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(eq(activities.userId, userId), inArray(activities.id, activityIds))
    );

  if (owned.length === 0) return;

  // If a manual order already exists, append new members at the end so they
  // don't pop up in the middle of the curated list.
  const [{ maxOrder }] = await db
    .select({
      maxOrder: sql<number | null>`max(${activityTourMembers.sortOrder})`,
    })
    .from(activityTourMembers)
    .where(eq(activityTourMembers.tourId, tourId));

  const nextOrder = maxOrder == null ? null : maxOrder + 1;

  const rows = owned.map((a, i) => ({
    tourId,
    activityId: a.id,
    sortOrder: nextOrder == null ? null : nextOrder + i,
  }));
  await db
    .insert(activityTourMembers)
    .values(rows)
    .onConflictDoNothing({
      target: [activityTourMembers.tourId, activityTourMembers.activityId],
    });

  revalidatePath(`/tours/${tourId}`);
  revalidatePath(`/tours/${tourId}/edit`);
}

export async function removeActivityFromTour(
  tourId: string,
  activityId: string
): Promise<void> {
  const userId = await requireUserId();
  await requireOwnedTour(userId, tourId);

  await db
    .delete(activityTourMembers)
    .where(
      and(
        eq(activityTourMembers.tourId, tourId),
        eq(activityTourMembers.activityId, activityId)
      )
    );

  revalidatePath(`/tours/${tourId}`);
  revalidatePath(`/tours/${tourId}/edit`);
}

export async function setTourMemberOrder(
  tourId: string,
  activityIds: string[]
): Promise<void> {
  const userId = await requireUserId();
  await requireOwnedTour(userId, tourId);

  if (activityIds.length === 0) return;

  const seen = new Set<string>();
  for (const id of activityIds) {
    if (seen.has(id)) throw new Error("Duplikat in der Reihenfolge");
    seen.add(id);
  }

  const current = await db
    .select({ activityId: activityTourMembers.activityId })
    .from(activityTourMembers)
    .where(eq(activityTourMembers.tourId, tourId));

  if (current.length !== activityIds.length) {
    throw new Error(
      "Die Tour wurde anderweitig geändert. Bitte Seite neu laden."
    );
  }
  const currentSet = new Set(current.map((r) => r.activityId));
  for (const id of activityIds) {
    if (!currentSet.has(id)) {
      throw new Error(
        "Eine Aktivität ist nicht (mehr) Teil der Tour. Bitte neu laden."
      );
    }
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < activityIds.length; i++) {
      await tx
        .update(activityTourMembers)
        .set({ sortOrder: i })
        .where(
          and(
            eq(activityTourMembers.tourId, tourId),
            eq(activityTourMembers.activityId, activityIds[i])
          )
        );
    }
    await tx
      .update(activityTours)
      .set({ updatedAt: new Date() })
      .where(eq(activityTours.id, tourId));
  });

  revalidatePath("/tours");
  revalidatePath(`/tours/${tourId}`);
  revalidatePath(`/tours/${tourId}/edit`);
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

export async function updateTourCoverPosition(
  tourId: string,
  x: number,
  y: number
): Promise<void> {
  const userId = await requireUserId();
  await requireOwnedTour(userId, tourId);

  await db
    .update(activityTours)
    .set({
      coverOffsetX: clampPercent(x),
      coverOffsetY: clampPercent(y),
      updatedAt: new Date(),
    })
    .where(eq(activityTours.id, tourId));

  revalidatePath("/tours");
  revalidatePath(`/tours/${tourId}`);
  revalidatePath(`/tours/${tourId}/edit`);
}
