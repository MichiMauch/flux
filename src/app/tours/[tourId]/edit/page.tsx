import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { BentoPageShell } from "../../../components/bento/bento-page-shell";
import { BentoPageHeader } from "../../../components/bento/bento-page-header";
import { spaceMono } from "../../../components/bento/bento-fonts";
import {
  getTour,
  getTourActivities,
} from "../../data";
import { TourCoverUploader } from "../../tour-cover-uploader";
import {
  TourActivityPicker,
  type PickableActivity,
} from "../../tour-activity-picker";
import { TourDetailsForm } from "../../tour-details-form";
import { TourDeleteButton } from "../../tour-delete-button";
import { TourMembersOrderEditor } from "../../tour-members-order-editor";

const PICKER_LIMIT = 1000;

function toDateInput(v: Date | string | null): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default async function EditTourPage({
  params,
}: {
  params: Promise<{ tourId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { tourId } = await params;

  // Kick off all userId/tourId-scoped queries in parallel. getTourActivities
  // and the per-user lookups don't depend on the tour ownership check, and
  // even if the user turns out not to own the tour we'd waste at most a few
  // cheap user-scoped reads (no data leak — getTourActivities gates on
  // getReadableOwnerId internally).
  // Edit page always shows members in date order so DnD has a stable starting
  // baseline; the viewer-side toggle on /tours/[id] decides whether to honour
  // the saved manual order.
  const [tour, members, meRow, sportRows] = await Promise.all([
    getTour(userId, tourId),
    getTourActivities(userId, tourId, "date"),
    db
      .select({ partnerId: users.partnerId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .selectDistinct({ type: activities.type })
      .from(activities)
      .where(eq(activities.userId, userId)),
  ]);

  if (!tour) notFound();
  if (tour.userId !== userId) {
    // Read-only sharing — non-owners can't edit
    redirect(`/tours/${tourId}`);
  }

  const memberIds = members.map((m) => m.id);
  const candidateWhere =
    memberIds.length > 0
      ? and(
          eq(activities.userId, userId),
          notInArray(activities.id, memberIds)
        )
      : eq(activities.userId, userId);

  // Second wave: partner detail (depends on meRow) + candidates (depends on
  // memberIds). Independent of each other, so still parallel.
  const partnerId = meRow[0]?.partnerId ?? null;
  const [candidatesRaw, partnerRows] = await Promise.all([
    db
      .select({
        id: activities.id,
        name: activities.name,
        type: activities.type,
        startTime: activities.startTime,
        distance: activities.distance,
      })
      .from(activities)
      .where(candidateWhere)
      .orderBy(desc(activities.startTime))
      .limit(PICKER_LIMIT),
    partnerId
      ? db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, partnerId))
          .limit(1)
      : Promise.resolve([] as { id: string; name: string | null }[]),
  ]);
  const partner = partnerRows[0] ?? null;
  const candidates: PickableActivity[] = candidatesRaw;
  const availableSports = sportRows.map((r) => r.type).sort();

  return (
    <BentoPageShell>
      <BentoPageHeader
        section="Tour bearbeiten"
        title={tour.name}
        right={
          <div className="flex items-center gap-3">
            <Link
              href={`/tours/${tour.id}`}
              className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
            >
              ← Zur Tour
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <TourDetailsForm
          tourId={tour.id}
          initial={{
            name: tour.name,
            description: tour.description,
            startDate: toDateInput(tour.startDate),
            endDate: toDateInput(tour.endDate),
            sharedWithPartner: tour.sharedWithPartner,
          }}
          partnerName={partner?.name ?? null}
        />

        <div className="space-y-3 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-6">
          <h2
            className={`${spaceMono.className} text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
          >
            Cover
          </h2>
          <TourCoverUploader
            tourId={tour.id}
            initialUrl={tour.coverPhotoPath}
            initialOffsetX={tour.coverOffsetX}
            initialOffsetY={tour.coverOffsetY}
          />
        </div>
      </div>

      <section className="space-y-3 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-6">
        <h2
          className={`${spaceMono.className} text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
        >
          Aktivitäten in dieser Tour ({members.length})
        </h2>
        <p className="text-[11px] text-[#7a7a7a]">
          Standardmässig nach Datum sortiert. Per Drag &amp; Drop in eine
          eigene Reihenfolge bringen und unten speichern — die Tour-Detailseite
          bekommt dann einen Umschalter „Datum / Manuell&ldquo;.
        </p>

        <TourMembersOrderEditor tourId={tour.id} members={members} />

        <TourActivityPicker
          tourId={tour.id}
          candidates={candidates}
          availableSports={availableSports}
        />
      </section>

      <section className="space-y-3 rounded-xl border border-red-900/40 bg-[#0a0a0a] p-6">
        <h2
          className={`${spaceMono.className} text-[11px] font-bold uppercase tracking-[0.14em] text-red-400`}
        >
          Gefahrenzone
        </h2>
        <p className="text-sm text-[#a3a3a3]">
          Die Tour wird unwiderruflich gelöscht. Die zugeordneten Aktivitäten
          bleiben erhalten.
        </p>
        <TourDeleteButton tourId={tour.id} tourName={tour.name} />
      </section>
    </BentoPageShell>
  );
}
