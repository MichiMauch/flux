import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BentoPageShell } from "../../components/bento/bento-page-shell";
import { BentoPageHeader } from "../../components/bento/bento-page-header";
import { spaceMono } from "../../components/bento/bento-fonts";
import { BentoTourStats } from "../../components/bento/tours/bento-tour-stats";
import { BentoTourMap } from "../../components/bento/tours/bento-tour-map";
import { BentoTourActivities } from "../../components/bento/tours/bento-tour-activities";
import { BentoTourPhotos } from "../../components/bento/tours/bento-tour-photos";
import { PhotoLightbox } from "../../components/photo-lightbox";
import type { MultiRouteEntry } from "../../components/multi-route-map-client";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getTour,
  getTourTotals,
  getTourActivities,
  getTourPhotos,
  tourHasManualOrder,
} from "../data";
import { TourSortToggle } from "../tour-sort-toggle";

function formatDateRangeLabel(
  start: Date | null,
  end: Date | null
): string {
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

export default async function TourDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tourId: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { tourId } = await params;
  const sp = await searchParams;
  const hasManualOrder = await tourHasManualOrder(userId, tourId);
  // If a manual order exists, default to it (it represents the owner's intent).
  // The viewer can override via ?sort=date.
  const requestedMode = sp.sort === "date" ? "date" : sp.sort === "manual" ? "manual" : null;
  const sortMode: "date" | "manual" =
    requestedMode ?? (hasManualOrder ? "manual" : "date");

  const [tour, totals, members, photos] = await Promise.all([
    getTour(userId, tourId),
    getTourTotals(userId, tourId),
    getTourActivities(userId, tourId, sortMode),
    getTourPhotos(userId, tourId),
  ]);

  if (!tour) notFound();

  const isOwner = tour.userId === userId;
  let ownerName: string | null = null;
  if (!isOwner) {
    const ownerRow = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, tour.userId))
      .limit(1);
    ownerName = ownerRow[0]?.name ?? null;
  }

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
    <BentoPageShell>
      <BentoPageHeader
        section="Tour"
        title={tour.name}
        right={
          <div className="flex items-center gap-3">
            {isOwner ? (
              <Link
                href={`/tours/${tour.id}/edit`}
                className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
              >
                Bearbeiten
              </Link>
            ) : null}
            <Link
              href="/tours"
              className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
            >
              ← Übersicht
            </Link>
          </div>
        }
      />

      {!isOwner && ownerName ? (
        <div
          className={`${spaceMono.className} inline-flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]`}
        >
          Von <span className="text-white">{ownerName}</span> geteilt
        </div>
      ) : null}

      {tour.coverPhotoPath ? (
        <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl border border-[#2a2a2a]">
          <Image
            src={tour.coverPhotoPath}
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
        {hasManualOrder ? (
          <TourSortToggle tourId={tour.id} current={sortMode} />
        ) : null}
        <BentoTourActivities members={members} tourId={tour.id} />
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
  );
}
