import "server-only";
import { db } from "@/lib/db";
import {
  activities,
  activityGroups,
  activityGroupMembers,
  activityPhotos,
  users,
} from "@/lib/db/schema";
import { and, eq, or, sql, desc, asc } from "drizzle-orm";

export interface GroupTotals {
  count: number;
  totalDistance: number;
  totalDuration: number;
  totalMovingTime: number;
  totalAscent: number;
  totalDescent: number;
  startDate: Date | null;
  endDate: Date | null;
}

export interface GroupSportBucket {
  type: string;
  count: number;
  totalDistance: number;
  totalDuration: number;
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  coverPhotoPath: string | null;
  coverOffsetX: number;
  coverOffsetY: number;
  sharedWithPartner: boolean;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  count: number;
  totalDistance: number;
  totalAscent: number;
  firstActivityStart: Date | null;
  lastActivityStart: Date | null;
  /** True when the calling user is not the owner. */
  sharedFromPartner: boolean;
  ownerName: string | null;
}

export interface GroupActivity {
  id: string;
  name: string;
  type: string;
  startTime: Date;
  duration: number | null;
  movingTime: number | null;
  distance: number | null;
  ascent: number | null;
  descent: number | null;
  routeData: { lat: number; lng: number }[] | null;
  locality: string | null;
  country: string | null;
}

/**
 * Returns the group owner's userId if the calling user has read access,
 * else null. Read access = owner OR (sharedWithPartner AND user is the
 * owner's configured partner).
 */
async function getReadableOwnerId(
  userId: string,
  groupId: string
): Promise<string | null> {
  const rows = await db
    .select({
      ownerId: activityGroups.userId,
      sharedWithPartner: activityGroups.sharedWithPartner,
      ownerPartnerId: users.partnerId,
    })
    .from(activityGroups)
    .innerJoin(users, eq(users.id, activityGroups.userId))
    .where(eq(activityGroups.id, groupId))
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  if (r.ownerId === userId) return r.ownerId;
  if (r.sharedWithPartner && r.ownerPartnerId === userId) return r.ownerId;
  return null;
}

export async function getGroup(userId: string, groupId: string) {
  const ownerId = await getReadableOwnerId(userId, groupId);
  if (!ownerId) return null;
  const rows = await db
    .select()
    .from(activityGroups)
    .where(eq(activityGroups.id, groupId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getGroupTotals(
  userId: string,
  groupId: string
): Promise<GroupTotals | null> {
  const ownerId = await getReadableOwnerId(userId, groupId);
  if (!ownerId) return null;

  const rows = await db
    .select({
      count: sql<number>`count(*)::int`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
      totalMovingTime: sql<number>`coalesce(sum(${activities.movingTime}), 0)`,
      totalAscent: sql<number>`coalesce(sum(${activities.ascent}), 0)`,
      totalDescent: sql<number>`coalesce(sum(${activities.descent}), 0)`,
      startDate: sql<Date | null>`min(${activities.startTime})`,
      endDate: sql<Date | null>`max(${activities.startTime})`,
    })
    .from(activityGroupMembers)
    .innerJoin(
      activities,
      eq(activityGroupMembers.activityId, activities.id)
    )
    .where(
      and(
        eq(activityGroupMembers.groupId, groupId),
        eq(activities.userId, ownerId)
      )
    );
  return rows[0];
}

export async function getGroupActivities(
  userId: string,
  groupId: string
): Promise<GroupActivity[]> {
  const ownerId = await getReadableOwnerId(userId, groupId);
  if (!ownerId) return [];

  const rows = await db
    .select({
      id: activities.id,
      name: activities.name,
      type: activities.type,
      startTime: activities.startTime,
      duration: activities.duration,
      movingTime: activities.movingTime,
      distance: activities.distance,
      ascent: activities.ascent,
      descent: activities.descent,
      routeData: activities.routeData,
      locality: activities.locality,
      country: activities.country,
    })
    .from(activityGroupMembers)
    .innerJoin(
      activities,
      eq(activityGroupMembers.activityId, activities.id)
    )
    .where(
      and(
        eq(activityGroupMembers.groupId, groupId),
        eq(activities.userId, ownerId)
      )
    )
    .orderBy(asc(activities.startTime));

  return rows.map((r) => ({
    ...r,
    routeData: r.routeData as GroupActivity["routeData"],
  }));
}

export async function getGroupSportBreakdown(
  userId: string,
  groupId: string
): Promise<GroupSportBucket[]> {
  const ownerId = await getReadableOwnerId(userId, groupId);
  if (!ownerId) return [];

  return db
    .select({
      type: activities.type,
      count: sql<number>`count(*)::int`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
    })
    .from(activityGroupMembers)
    .innerJoin(
      activities,
      eq(activityGroupMembers.activityId, activities.id)
    )
    .where(
      and(
        eq(activityGroupMembers.groupId, groupId),
        eq(activities.userId, ownerId)
      )
    )
    .groupBy(activities.type)
    .orderBy(desc(sql`sum(${activities.distance})`));
}

export async function listGroupsForUser(
  userId: string
): Promise<GroupSummary[]> {
  // Step 1: collect all visible group ids — own + shared by partner
  const me = await db
    .select({ partnerId: users.partnerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const partnerId = me[0]?.partnerId ?? null;

  const visibilityWhere = partnerId
    ? or(
        eq(activityGroups.userId, userId),
        and(
          eq(activityGroups.userId, partnerId),
          eq(activityGroups.sharedWithPartner, true)
        )
      )!
    : eq(activityGroups.userId, userId);

  const rows = await db
    .select({
      id: activityGroups.id,
      name: activityGroups.name,
      description: activityGroups.description,
      coverPhotoPath: activityGroups.coverPhotoPath,
      coverOffsetX: activityGroups.coverOffsetX,
      coverOffsetY: activityGroups.coverOffsetY,
      sharedWithPartner: activityGroups.sharedWithPartner,
      startDate: activityGroups.startDate,
      endDate: activityGroups.endDate,
      createdAt: activityGroups.createdAt,
      ownerId: activityGroups.userId,
      ownerName: users.name,
      count: sql<number>`count(${activities.id})::int`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalAscent: sql<number>`coalesce(sum(${activities.ascent}), 0)`,
      firstActivityStart: sql<Date | null>`min(${activities.startTime})`,
      lastActivityStart: sql<Date | null>`max(${activities.startTime})`,
    })
    .from(activityGroups)
    .innerJoin(users, eq(users.id, activityGroups.userId))
    .leftJoin(
      activityGroupMembers,
      eq(activityGroups.id, activityGroupMembers.groupId)
    )
    .leftJoin(
      activities,
      and(
        eq(activityGroupMembers.activityId, activities.id),
        eq(activities.userId, activityGroups.userId)
      )
    )
    .where(visibilityWhere)
    .groupBy(activityGroups.id, users.name)
    .orderBy(desc(activityGroups.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    coverPhotoPath: r.coverPhotoPath,
    coverOffsetX: r.coverOffsetX,
    coverOffsetY: r.coverOffsetY,
    sharedWithPartner: r.sharedWithPartner,
    startDate: r.startDate,
    endDate: r.endDate,
    createdAt: r.createdAt,
    count: r.count,
    totalDistance: r.totalDistance,
    totalAscent: r.totalAscent,
    firstActivityStart: r.firstActivityStart,
    lastActivityStart: r.lastActivityStart,
    sharedFromPartner: r.ownerId !== userId,
    ownerName: r.ownerId !== userId ? r.ownerName : null,
  }));
}

export interface GroupPhoto {
  id: string;
  activityId: string;
  takenAt: Date | null;
  location: string | null;
}

export async function getGroupPhotos(
  userId: string,
  groupId: string
): Promise<GroupPhoto[]> {
  const ownerId = await getReadableOwnerId(userId, groupId);
  if (!ownerId) return [];

  const rows = await db
    .select({
      id: activityPhotos.id,
      activityId: activityPhotos.activityId,
      takenAt: activityPhotos.takenAt,
      location: activityPhotos.location,
    })
    .from(activityGroupMembers)
    .innerJoin(
      activities,
      eq(activityGroupMembers.activityId, activities.id)
    )
    .innerJoin(
      activityPhotos,
      eq(activityPhotos.activityId, activities.id)
    )
    .where(
      and(
        eq(activityGroupMembers.groupId, groupId),
        eq(activities.userId, ownerId)
      )
    )
    .orderBy(asc(activityPhotos.takenAt), asc(activityPhotos.id));

  return rows;
}

export async function getGroupsForActivity(
  userId: string,
  activityId: string
) {
  return db
    .select({
      id: activityGroups.id,
      name: activityGroups.name,
    })
    .from(activityGroupMembers)
    .innerJoin(
      activityGroups,
      eq(activityGroupMembers.groupId, activityGroups.id)
    )
    .where(
      and(
        eq(activityGroupMembers.activityId, activityId),
        eq(activityGroups.userId, userId)
      )
    )
    .orderBy(asc(activityGroups.name));
}
