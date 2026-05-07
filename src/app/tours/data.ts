import "server-only";
import { db } from "@/lib/db";
import {
  activities,
  activityTours,
  activityTourMembers,
  activityPhotos,
  users,
} from "@/lib/db/schema";
import { and, eq, or, sql, desc, asc } from "drizzle-orm";

export interface TourTotals {
  count: number;
  totalDistance: number;
  totalDuration: number;
  totalMovingTime: number;
  totalAscent: number;
  totalDescent: number;
  startDate: Date | null;
  endDate: Date | null;
}

export interface TourSportBucket {
  type: string;
  count: number;
  totalDistance: number;
  totalDuration: number;
}

export interface TourSummary {
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

export interface TourActivity {
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
  sortOrder: number | null;
}

/**
 * Returns the tour owner's userId if the calling user has read access,
 * else null. Read access = owner OR (sharedWithPartner AND user is the
 * owner's configured partner).
 */
async function getReadableOwnerId(
  userId: string,
  tourId: string
): Promise<string | null> {
  const rows = await db
    .select({
      ownerId: activityTours.userId,
      sharedWithPartner: activityTours.sharedWithPartner,
      ownerPartnerId: users.partnerId,
    })
    .from(activityTours)
    .innerJoin(users, eq(users.id, activityTours.userId))
    .where(eq(activityTours.id, tourId))
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  if (r.ownerId === userId) return r.ownerId;
  if (r.sharedWithPartner && r.ownerPartnerId === userId) return r.ownerId;
  return null;
}

export async function getTour(userId: string, tourId: string) {
  const ownerId = await getReadableOwnerId(userId, tourId);
  if (!ownerId) return null;
  const rows = await db
    .select()
    .from(activityTours)
    .where(eq(activityTours.id, tourId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTourTotals(
  userId: string,
  tourId: string
): Promise<TourTotals | null> {
  const ownerId = await getReadableOwnerId(userId, tourId);
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
    .from(activityTourMembers)
    .innerJoin(
      activities,
      eq(activityTourMembers.activityId, activities.id)
    )
    .where(
      and(
        eq(activityTourMembers.tourId, tourId),
        eq(activities.userId, ownerId)
      )
    );
  return rows[0];
}

export async function getTourActivities(
  userId: string,
  tourId: string,
  mode: "date" | "manual" = "date"
): Promise<TourActivity[]> {
  const ownerId = await getReadableOwnerId(userId, tourId);
  if (!ownerId) return [];

  const baseQuery = db
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
      sortOrder: activityTourMembers.sortOrder,
    })
    .from(activityTourMembers)
    .innerJoin(
      activities,
      eq(activityTourMembers.activityId, activities.id)
    )
    .where(
      and(
        eq(activityTourMembers.tourId, tourId),
        eq(activities.userId, ownerId)
      )
    );

  const rows =
    mode === "manual"
      ? await baseQuery.orderBy(
          // NULLS LAST so members without an explicit position go to the end.
          sql`${activityTourMembers.sortOrder} ASC NULLS LAST`,
          asc(activities.startTime)
        )
      : await baseQuery.orderBy(asc(activities.startTime));

  return rows.map((r) => ({
    ...r,
    routeData: r.routeData as TourActivity["routeData"],
  }));
}

/**
 * True iff the tour has at least one member with a non-null sortOrder —
 * i.e. the owner has explicitly arranged the tour at some point.
 */
export async function tourHasManualOrder(
  userId: string,
  tourId: string
): Promise<boolean> {
  const ownerId = await getReadableOwnerId(userId, tourId);
  if (!ownerId) return false;
  const rows = await db
    .select({ id: activityTourMembers.activityId })
    .from(activityTourMembers)
    .where(
      and(
        eq(activityTourMembers.tourId, tourId),
        sql`${activityTourMembers.sortOrder} IS NOT NULL`
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function getTourSportBreakdown(
  userId: string,
  tourId: string
): Promise<TourSportBucket[]> {
  const ownerId = await getReadableOwnerId(userId, tourId);
  if (!ownerId) return [];

  return db
    .select({
      type: activities.type,
      count: sql<number>`count(*)::int`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
    })
    .from(activityTourMembers)
    .innerJoin(
      activities,
      eq(activityTourMembers.activityId, activities.id)
    )
    .where(
      and(
        eq(activityTourMembers.tourId, tourId),
        eq(activities.userId, ownerId)
      )
    )
    .groupBy(activities.type)
    .orderBy(desc(sql`sum(${activities.distance})`));
}

export async function listToursForUser(
  userId: string
): Promise<TourSummary[]> {
  // Step 1: collect all visible tour ids — own + shared by partner
  const me = await db
    .select({ partnerId: users.partnerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const partnerId = me[0]?.partnerId ?? null;

  const visibilityWhere = partnerId
    ? or(
        eq(activityTours.userId, userId),
        and(
          eq(activityTours.userId, partnerId),
          eq(activityTours.sharedWithPartner, true)
        )
      )!
    : eq(activityTours.userId, userId);

  const rows = await db
    .select({
      id: activityTours.id,
      name: activityTours.name,
      description: activityTours.description,
      coverPhotoPath: activityTours.coverPhotoPath,
      coverOffsetX: activityTours.coverOffsetX,
      coverOffsetY: activityTours.coverOffsetY,
      sharedWithPartner: activityTours.sharedWithPartner,
      startDate: activityTours.startDate,
      endDate: activityTours.endDate,
      createdAt: activityTours.createdAt,
      ownerId: activityTours.userId,
      ownerName: users.name,
      count: sql<number>`count(${activities.id})::int`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalAscent: sql<number>`coalesce(sum(${activities.ascent}), 0)`,
      firstActivityStart: sql<Date | null>`min(${activities.startTime})`,
      lastActivityStart: sql<Date | null>`max(${activities.startTime})`,
    })
    .from(activityTours)
    .innerJoin(users, eq(users.id, activityTours.userId))
    .leftJoin(
      activityTourMembers,
      eq(activityTours.id, activityTourMembers.tourId)
    )
    .leftJoin(
      activities,
      and(
        eq(activityTourMembers.activityId, activities.id),
        eq(activities.userId, activityTours.userId)
      )
    )
    .where(visibilityWhere)
    .groupBy(activityTours.id, users.name)
    .orderBy(desc(activityTours.createdAt));

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

export interface TourPhoto {
  id: string;
  activityId: string;
  takenAt: Date | null;
  location: string | null;
}

export async function getTourPhotos(
  userId: string,
  tourId: string
): Promise<TourPhoto[]> {
  const ownerId = await getReadableOwnerId(userId, tourId);
  if (!ownerId) return [];

  const rows = await db
    .select({
      id: activityPhotos.id,
      activityId: activityPhotos.activityId,
      takenAt: activityPhotos.takenAt,
      location: activityPhotos.location,
    })
    .from(activityTourMembers)
    .innerJoin(
      activities,
      eq(activityTourMembers.activityId, activities.id)
    )
    .innerJoin(
      activityPhotos,
      eq(activityPhotos.activityId, activities.id)
    )
    .where(
      and(
        eq(activityTourMembers.tourId, tourId),
        eq(activities.userId, ownerId)
      )
    )
    .orderBy(asc(activityPhotos.takenAt), asc(activityPhotos.id));

  return rows;
}

export async function getToursForActivity(
  userId: string,
  activityId: string
) {
  return db
    .select({
      id: activityTours.id,
      name: activityTours.name,
    })
    .from(activityTourMembers)
    .innerJoin(
      activityTours,
      eq(activityTourMembers.tourId, activityTours.id)
    )
    .where(
      and(
        eq(activityTourMembers.activityId, activityId),
        eq(activityTours.userId, userId)
      )
    )
    .orderBy(asc(activityTours.name));
}
