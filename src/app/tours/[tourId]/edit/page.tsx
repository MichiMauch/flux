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

function toDateInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
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
  const tour = await getTour(userId, tourId);
  if (!tour) notFound();
  if (tour.userId !== userId) {
    // Read-only sharing — non-owners can't edit
    redirect(`/tours/${tourId}`);
  }

  const meRow = await db
    .select({ partnerId: users.partnerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const partner = meRow[0]?.partnerId
    ? (
        await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, meRow[0].partnerId))
          .limit(1)
      )[0] ?? null
    : null;

  const members = await getTourActivities(userId, tourId);

  const memberIds = members.map((m) => m.id);
  const candidateWhere =
    memberIds.length > 0
      ? and(
          eq(activities.userId, userId),
          notInArray(activities.id, memberIds)
        )
      : eq(activities.userId, userId);

  const [candidatesRaw, sportRows] = await Promise.all([
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
    db
      .selectDistinct({ type: activities.type })
      .from(activities)
      .where(eq(activities.userId, userId)),
  ]);
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
            sortMode: tour.sortMode === "manual" ? "manual" : "date",
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

        <TourMembersOrderEditor
          tourId={tour.id}
          sortMode={tour.sortMode === "manual" ? "manual" : "date"}
          members={members}
        />

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
