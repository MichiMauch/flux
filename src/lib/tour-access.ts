import "server-only";
import { db } from "@/lib/db";
import { activityTours, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface TourAccess {
  ownerId: string;
  isOwner: boolean;
  /**
   * Wessen Aktivitäten zur Tour zählen: immer die der Besitzer:in, bei einer
   * geteilten Tour zusätzlich die der Partner:in. Mitgliedschaften einer
   * Person ausserhalb dieser Liste bleiben gespeichert, werden aber nicht
   * angezeigt — so kommen sie zurück, wenn die Tour wieder geteilt wird.
   */
  participantIds: string[];
}

/**
 * Lese- und Schreibrecht sind bei Touren dasselbe: Besitzer:in, oder die
 * Partner:in der Besitzer:in, sobald die Tour geteilt ist. Die Partner:in darf
 * alles, was die Besitzer:in darf, ausser das Teilen selbst abzuschalten.
 */
export async function getTourAccess(
  userId: string,
  tourId: string
): Promise<TourAccess | null> {
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

  const partnerId = r.sharedWithPartner ? r.ownerPartnerId : null;
  const participantIds = partnerId ? [r.ownerId, partnerId] : [r.ownerId];

  if (r.ownerId === userId) {
    return { ownerId: r.ownerId, isOwner: true, participantIds };
  }
  if (partnerId && partnerId === userId) {
    return { ownerId: r.ownerId, isOwner: false, participantIds };
  }
  return null;
}
