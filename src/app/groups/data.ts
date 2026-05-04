import "server-only";
import { db } from "@/lib/db";
import {
  activities,
  activityGroups,
  activityGroupMembers,
} from "@/lib/db/schema";
import { and, eq, sql, desc, asc } from "drizzle-orm";

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
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  count: number;
  totalDistance: number;
  totalAscent: number;
  firstActivityStart: Date | null;
  lastActivityStart: Date | null;
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

async function ensureGroupOwnership(userId: string, groupId: string) {
  const rows = await db
    .select({ id: activityGroups.id })
    .from(activityGroups)
    .where(
      and(eq(activityGroups.id, groupId), eq(activityGroups.userId, userId))
    )
    .limit(1);
  return rows.length > 0;
}

export async function getGroup(userId: string, groupId: string) {
  const rows = await db
    .select()
    .from(activityGroups)
    .where(
      and(eq(activityGroups.id, groupId), eq(activityGroups.userId, userId))
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getGroupTotals(
  userId: string,
  groupId: string
): Promise<GroupTotals | null> {
  if (!(await ensureGroupOwnership(userId, groupId))) return null;

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
        eq(activities.userId, userId)
      )
    );
  return rows[0];
}

export async function getGroupActivities(
  userId: string,
  groupId: string
): Promise<GroupActivity[]> {
  if (!(await ensureGroupOwnership(userId, groupId))) return [];

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
        eq(activities.userId, userId)
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
  if (!(await ensureGroupOwnership(userId, groupId))) return [];

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
        eq(activities.userId, userId)
      )
    )
    .groupBy(activities.type)
    .orderBy(desc(sql`sum(${activities.distance})`));
}

export async function listGroupsForUser(
  userId: string
): Promise<GroupSummary[]> {
  return db
    .select({
      id: activityGroups.id,
      name: activityGroups.name,
      description: activityGroups.description,
      coverPhotoPath: activityGroups.coverPhotoPath,
      coverOffsetX: activityGroups.coverOffsetX,
      coverOffsetY: activityGroups.coverOffsetY,
      startDate: activityGroups.startDate,
      endDate: activityGroups.endDate,
      createdAt: activityGroups.createdAt,
      count: sql<number>`count(${activities.id})::int`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalAscent: sql<number>`coalesce(sum(${activities.ascent}), 0)`,
      firstActivityStart: sql<Date | null>`min(${activities.startTime})`,
      lastActivityStart: sql<Date | null>`max(${activities.startTime})`,
    })
    .from(activityGroups)
    .leftJoin(
      activityGroupMembers,
      eq(activityGroups.id, activityGroupMembers.groupId)
    )
    .leftJoin(
      activities,
      and(
        eq(activityGroupMembers.activityId, activities.id),
        eq(activities.userId, userId)
      )
    )
    .where(eq(activityGroups.userId, userId))
    .groupBy(activityGroups.id)
    .orderBy(desc(activityGroups.createdAt));
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
