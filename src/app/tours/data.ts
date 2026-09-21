import "server-only";
import { db } from "@/lib/db";
import {
  activities,
  activityTours,
  activityTourMembers,
  activityPhotos,
  users,
} from "@/lib/db/schema";
import { and, eq, or, sql, asc, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getTourAccess, type TourAccess } from "@/lib/tour-access";
import { mergeSameOutings } from "@/lib/tour-merge";

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

export interface TourSummary {
  id: string;
  name: string;
  description: string | null;
  coverPhotoPath: string | null;
  coverOffsetX: number;
  coverOffsetY: number;
  sharedWithPartner: boolean;
  completed: boolean;
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

export interface TourParticipant {
  id: string;
  name: string | null;
  image: string | null;
}

export interface TourActivity {
  id: string;
  userId: string;
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
  /**
   * Wer diese Etappe gemacht hat. Bei einer zusammengeführten Etappe beide
   * Personen, die führende zuerst; sonst nur die eine.
   */
  participants: TourParticipant[];
}

type MemberRow = Omit<TourActivity, "participants"> & {
  userName: string | null;
  userImage: string | null;
};

async function loadMemberRows(
  access: TourAccess,
  tourId: string,
  mode: "date" | "manual"
): Promise<MemberRow[]> {
  const baseQuery = db
    .select({
      id: activities.id,
      userId: activities.userId,
      name: activities.name,
      type: activities.type,
      startTime: activities.startTime,
      duration: activities.duration,
      movingTime: activities.movingTime,
      distance: activities.distance,
      ascent: activities.ascent,
      descent: activities.descent,
      // Tour-Karte und Listen-Vorschau zeichnen nur den groben Verlauf —
      // die vereinfachte Geometrie reicht und spart pro Aktivitaet den
      // vollen Track.
      routeData: activities.routeGeometry,
      locality: activities.locality,
      country: activities.country,
      sortOrder: activityTourMembers.sortOrder,
      userName: users.name,
      userImage: users.image,
    })
    .from(activityTourMembers)
    .innerJoin(
      activities,
      eq(activityTourMembers.activityId, activities.id)
    )
    .innerJoin(users, eq(users.id, activities.userId))
    .where(
      and(
        eq(activityTourMembers.tourId, tourId),
        inArray(activities.userId, access.participantIds)
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

function participantOf(r: MemberRow): TourParticipant {
  return { id: r.userId, name: r.userName, image: r.userImage };
}

function toTourActivity(r: MemberRow, companions: MemberRow[]): TourActivity {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userName, userImage, ...rest } = r;
  const participants = [participantOf(r)];
  for (const c of companions) {
    if (!participants.some((p) => p.id === c.userId)) {
      participants.push(participantOf(c));
    }
  }
  return { ...rest, participants };
}

function computeTotals(stages: TourActivity[]): TourTotals {
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  const totals: TourTotals = {
    count: stages.length,
    totalDistance: 0,
    totalDuration: 0,
    totalMovingTime: 0,
    totalAscent: 0,
    totalDescent: 0,
    startDate: null,
    endDate: null,
  };
  for (const s of stages) {
    totals.totalDistance += s.distance ?? 0;
    totals.totalDuration += s.duration ?? 0;
    // Fallback movingTime -> duration pro Etappe, damit Polar-Etappen ohne
    // FIT-movingTime trotzdem zählen. Deckt sich mit bento-tour-activities.tsx.
    totals.totalMovingTime += s.movingTime ?? s.duration ?? 0;
    totals.totalAscent += s.ascent ?? 0;
    totals.totalDescent += s.descent ?? 0;
    const t = new Date(s.startTime);
    if (!startDate || t < startDate) startDate = t;
    if (!endDate || t > endDate) endDate = t;
  }
  totals.startDate = startDate;
  totals.endDate = endDate;
  return totals;
}

/**
 * Etappen der Tour, doppelt aufgezeichnete bereits zusammengeführt. Die Werte
 * einer zusammengeführten Etappe kommen von der Besitzer:in der Tour.
 */
async function loadStages(
  access: TourAccess,
  tourId: string,
  mode: "date" | "manual"
): Promise<TourActivity[]> {
  const rows = await loadMemberRows(access, tourId, mode);
  return mergeSameOutings(rows, access.ownerId).map((g) =>
    toTourActivity(g.primary, g.companions)
  );
}

export async function getTour(userId: string, tourId: string) {
  const access = await getTourAccess(userId, tourId);
  if (!access) return null;
  const rows = await db
    .select()
    .from(activityTours)
    .where(eq(activityTours.id, tourId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Alles, was die Detail- und die Share-Seite brauchen, aus einer einzigen
 * Mitglieder-Abfrage: Etappen (zusammengeführt) und die Summen darüber.
 */
export async function getTourStages(
  userId: string,
  tourId: string,
  mode: "date" | "manual" = "date"
): Promise<{ stages: TourActivity[]; totals: TourTotals } | null> {
  const access = await getTourAccess(userId, tourId);
  if (!access) return null;
  const stages = await loadStages(access, tourId, mode);
  return { stages, totals: computeTotals(stages) };
}

/**
 * Rohe Mitglieder ohne Zusammenführung — für die Bearbeiten-Seite, auf der
 * jede Aufzeichnung einzeln entfernt und sortiert werden kann.
 */
export async function getTourMembers(
  userId: string,
  tourId: string
): Promise<TourActivity[]> {
  const access = await getTourAccess(userId, tourId);
  if (!access) return [];
  const rows = await loadMemberRows(access, tourId, "date");
  return rows.map((r) => toTourActivity(r, []));
}

/**
 * True iff the tour has at least one member with a non-null sortOrder —
 * i.e. someone has explicitly arranged the tour at some point.
 */
export async function tourHasManualOrder(
  userId: string,
  tourId: string
): Promise<boolean> {
  const access = await getTourAccess(userId, tourId);
  if (!access) return false;
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

export async function listToursForUser(
  userId: string
): Promise<TourSummary[]> {
  // Step 1: collect all visible tours — own + shared by partner
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

  const tours = await db
    .select({
      id: activityTours.id,
      name: activityTours.name,
      description: activityTours.description,
      coverPhotoPath: activityTours.coverPhotoPath,
      coverOffsetX: activityTours.coverOffsetX,
      coverOffsetY: activityTours.coverOffsetY,
      sharedWithPartner: activityTours.sharedWithPartner,
      completed: activityTours.completed,
      startDate: activityTours.startDate,
      endDate: activityTours.endDate,
      createdAt: activityTours.createdAt,
      ownerId: activityTours.userId,
      ownerName: users.name,
      ownerPartnerId: users.partnerId,
    })
    .from(activityTours)
    .innerJoin(users, eq(users.id, activityTours.userId))
    .where(visibilityWhere);

  // Step 2: all member activities of those tours in one query, restricted to
  // each tour's participants (owner + partner if shared).
  const tourIds = tours.map((t) => t.id);
  const owner = alias(users, "tour_owner");
  const memberRows =
    tourIds.length === 0
      ? []
      : await db
          .select({
            tourId: activityTourMembers.tourId,
            id: activities.id,
            userId: activities.userId,
            startTime: activities.startTime,
            duration: activities.duration,
            movingTime: activities.movingTime,
            distance: activities.distance,
            ascent: activities.ascent,
            startPoint: sql<{ lat: number; lng: number } | null>`${activities.routeGeometry}->0`,
          })
          .from(activityTourMembers)
          .innerJoin(
            activities,
            eq(activityTourMembers.activityId, activities.id)
          )
          .innerJoin(
            activityTours,
            eq(activityTours.id, activityTourMembers.tourId)
          )
          .innerJoin(owner, eq(owner.id, activityTours.userId))
          .where(
            and(
              inArray(activityTourMembers.tourId, tourIds),
              or(
                eq(activities.userId, activityTours.userId),
                and(
                  eq(activityTours.sharedWithPartner, true),
                  eq(activities.userId, owner.partnerId)
                )
              )
            )
          )
          .orderBy(asc(activities.startTime));

  const membersByTour = new Map<string, typeof memberRows>();
  for (const m of memberRows) {
    const list = membersByTour.get(m.tourId) ?? [];
    list.push(m);
    membersByTour.set(m.tourId, list);
  }

  const summaries = tours.map((t) => {
    const rows = (membersByTour.get(t.id) ?? []).map((m) => ({
      ...m,
      routeData: m.startPoint ? [m.startPoint] : null,
    }));
    const stages = mergeSameOutings(rows, t.ownerId).map((g) => g.primary);
    let totalDistance = 0;
    let totalAscent = 0;
    let first: Date | null = null;
    let last: Date | null = null;
    for (const s of stages) {
      totalDistance += s.distance ?? 0;
      totalAscent += s.ascent ?? 0;
      const d = new Date(s.startTime);
      if (!first || d < first) first = d;
      if (!last || d > last) last = d;
    }
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      coverPhotoPath: t.coverPhotoPath,
      coverOffsetX: t.coverOffsetX,
      coverOffsetY: t.coverOffsetY,
      sharedWithPartner: t.sharedWithPartner,
      completed: t.completed,
      startDate: t.startDate,
      endDate: t.endDate,
      createdAt: t.createdAt,
      count: stages.length,
      totalDistance,
      totalAscent,
      firstActivityStart: first,
      lastActivityStart: last,
      sharedFromPartner: t.ownerId !== userId,
      ownerName: t.ownerId !== userId ? t.ownerName : null,
    } satisfies TourSummary;
  });

  // Neueste zuerst: Enddatum, sonst Startdatum, sonst letzte Aktivität;
  // Touren ganz ohne Datum ans Ende, dort nach Erstellungsdatum.
  const sortKey = (s: TourSummary) =>
    (s.endDate ?? s.startDate ?? s.lastActivityStart)?.getTime() ?? null;
  return summaries.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (ka !== kb) {
      if (ka == null) return 1;
      if (kb == null) return -1;
      return kb - ka;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export interface TourPhoto {
  id: string;
  activityId: string;
  takenAt: Date | null;
  location: string | null;
}

/**
 * Fotos aller Etappen, auch die der zusammengeführten Aufzeichnungen — so
 * landen bei einer gemeinsamen Etappe die Fotos beider Personen in der Tour.
 */
export async function getTourPhotos(
  userId: string,
  tourId: string
): Promise<TourPhoto[]> {
  const access = await getTourAccess(userId, tourId);
  if (!access) return [];

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
        inArray(activities.userId, access.participantIds)
      )
    )
    .orderBy(asc(activityPhotos.takenAt), asc(activityPhotos.id));

  return rows;
}

/** Touren, in denen die Aktivität steckt und die der User sehen darf. */
export async function getToursForActivity(
  userId: string,
  activityId: string
) {
  const owner = alias(users, "tour_owner");
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
    .innerJoin(owner, eq(owner.id, activityTours.userId))
    .where(
      and(
        eq(activityTourMembers.activityId, activityId),
        or(
          eq(activityTours.userId, userId),
          and(
            eq(activityTours.sharedWithPartner, true),
            eq(owner.partnerId, userId)
          )
        )
      )
    )
    .orderBy(asc(activityTours.name));
}
