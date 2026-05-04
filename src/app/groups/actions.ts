"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  activities,
  activityGroups,
  activityGroupMembers,
} from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { unlink } from "fs/promises";
import { getGroupCoverPath } from "@/lib/group-covers";

const NAME_MAX = 120;
const DESC_MAX = 2000;

async function requireUserId() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  return id;
}

async function requireOwnedGroup(userId: string, groupId: string) {
  const rows = await db
    .select({ id: activityGroups.id })
    .from(activityGroups)
    .where(
      and(eq(activityGroups.id, groupId), eq(activityGroups.userId, userId))
    )
    .limit(1);
  if (rows.length === 0) throw new Error("Group not found");
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

export async function createGroup(formData: FormData): Promise<string> {
  const userId = await requireUserId();

  const name = parseName(formData.get("name"));
  const description = parseDescription(formData.get("description"));
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));

  const [created] = await db
    .insert(activityGroups)
    .values({ userId, name, description, startDate, endDate })
    .returning({ id: activityGroups.id });

  revalidatePath("/groups");
  return created.id;
}

export async function updateGroup(
  groupId: string,
  formData: FormData
): Promise<void> {
  const userId = await requireUserId();
  await requireOwnedGroup(userId, groupId);

  const name = parseName(formData.get("name"));
  const description = parseDescription(formData.get("description"));
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));

  await db
    .update(activityGroups)
    .set({
      name,
      description,
      startDate,
      endDate,
      updatedAt: new Date(),
    })
    .where(eq(activityGroups.id, groupId));

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/edit`);
}

export async function deleteGroup(groupId: string): Promise<void> {
  const userId = await requireUserId();
  await requireOwnedGroup(userId, groupId);

  await db.delete(activityGroups).where(eq(activityGroups.id, groupId));
  await unlink(getGroupCoverPath(groupId)).catch(() => {});

  revalidatePath("/groups");
}

export async function addActivitiesToGroup(
  groupId: string,
  activityIds: string[]
): Promise<void> {
  const userId = await requireUserId();
  await requireOwnedGroup(userId, groupId);

  if (activityIds.length === 0) return;

  const owned = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(eq(activities.userId, userId), inArray(activities.id, activityIds))
    );

  if (owned.length === 0) return;

  const rows = owned.map((a) => ({ groupId, activityId: a.id }));
  await db
    .insert(activityGroupMembers)
    .values(rows)
    .onConflictDoNothing({
      target: [activityGroupMembers.groupId, activityGroupMembers.activityId],
    });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/edit`);
}

export async function removeActivityFromGroup(
  groupId: string,
  activityId: string
): Promise<void> {
  const userId = await requireUserId();
  await requireOwnedGroup(userId, groupId);

  await db
    .delete(activityGroupMembers)
    .where(
      and(
        eq(activityGroupMembers.groupId, groupId),
        eq(activityGroupMembers.activityId, activityId)
      )
    );

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/edit`);
}
