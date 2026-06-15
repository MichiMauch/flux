import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { BentoPageShell } from "@/app/components/bento/bento-page-shell";
import { BentoPageHeader } from "@/app/components/bento/bento-page-header";
import { spaceMono } from "@/app/components/bento/bento-fonts";
import { BentoTourStats } from "@/app/components/bento/tours/bento-tour-stats";
import { BentoTourMap } from "@/app/components/bento/tours/bento-tour-map";
import { BentoTourActivities } from "@/app/components/bento/tours/bento-tour-activities";
import { BentoTourPhotos } from "@/app/components/bento/tours/bento-tour-photos";
import { PhotoLightbox } from "@/app/components/photo-lightbox";
import type { MultiRouteEntry } from "@/app/components/multi-route-map-client";
import { db } from "@/lib/db";
import { activityTours, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getTourTotals,
  getTourActivities,
  getTourPhotos,
} from "@/app/tours/data";
import { ShareTokenProvider, appendShareToken } from "@/lib/share-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Geteilte Tour",
  robots: {
    index: false,
    follow: false,
  },
};

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateRangeLabel(
  startIn: Date | string | null,
  endIn: Date | string | null
): string {
  const start = toDate(startIn);
  const end = toDate(endIn);
  if (!start && !end) return "—";
  const fmt = (d: Date) =>
    d.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  if (start && end) {
    if (start.getTime() === end.getTime()) return fmt(start);
    return `${fmt(start)} – ${fmt(end)}`;
  }
  return fmt((start ?? end)!);
}

export default async function SharedTourPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const tourRows = await db
    .select({
      id: activityTours.id,
      userId: activityTours.userId,
      name: activityTours.name,
      description: activityTours.description,
      coverPhotoPath: activityTours.coverPhotoPath,
      coverOffsetX: activityTours.coverOffsetX,
      coverOffsetY: activityTours.coverOffsetY,
      startDate: activityTours.startDate,
      endDate: activityTours.endDate,
      ownerName: users.name,
    })
    .from(activityTours)
    .innerJoin(users, eq(users.id, activityTours.userId))
    .where(eq(activityTours.shareToken, token))
    .limit(1);

  if (tourRows.length === 0) notFound();
  const tour = tourRows[0];

  const [totals, members, photos] = await Promise.all([
    getTourTotals(tour.userId, tour.id),
    getTourActivities(tour.userId, tour.id, "manual"),
    getTourPhotos(tour.userId, tour.id),
  ]);

  const routes: MultiRouteEntry[] = members
    .filter(
      (a): a is typeof a & { routeData: { lat: number; lng: number }[] } =>
        Array.isArray(a.routeData) && a.routeData.length >= 2
    )
    .map((a) => ({
      activityId: a.id,
      name: a.name,
      routeData: a.routeData,
      type: a.type,
      distance: a.distance,
      ascent: a.ascent,
      movingTime: a.movingTime,
      startTime: a.startTime,
    }));

  const dateRangeLabel = formatDateRangeLabel(
    tour.startDate ?? totals?.startDate ?? null,
    tour.endDate ?? totals?.endDate ?? null
  );

  return (
    <ShareTokenProvider token={token}>
      <BentoPageShell>
        <BentoPageHeader section="Tour" title={tour.name} />

        <div
          className={`${spaceMono.className} inline-flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]`}
        >
          Von <span className="text-white">{tour.ownerName ?? "User"}</span> geteilt · Flux
        </div>

        {tour.coverPhotoPath ? (
          <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl border border-[#2a2a2a]">
            <Image
              src={appendShareToken(tour.coverPhotoPath, token)}
              alt={tour.name}
              fill
              sizes="(min-width: 1280px) 1280px, 100vw"
              priority
              unoptimized
              className="object-cover"
              style={{
                objectPosition: `${tour.coverOffsetX}% ${tour.coverOffsetY}%`,
              }}
            />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
            {tour.description ? (
              <div className="absolute inset-x-0 bottom-0 p-5 text-sm text-white">
                {tour.description}
              </div>
            ) : null}
          </div>
        ) : tour.description ? (
          <p className="text-sm text-[#a3a3a3]">{tour.description}</p>
        ) : null}

        <div className="grid grid-cols-1 gap-4">
          <BentoTourStats totals={totals} dateRangeLabel={dateRangeLabel} />
          <BentoTourMap routes={routes} />
          <BentoTourActivities
            members={members}
            tourId={tour.id}
            interactive={false}
          />
          <BentoTourPhotos photos={photos} />
        </div>

        {photos.length > 0 && (
          <PhotoLightbox
            photos={photos.map((p) => ({
              id: p.id,
              location: p.location,
              takenAt: p.takenAt,
            }))}
          />
        )}
      </BentoPageShell>
    </ShareTokenProvider>
  );
}
