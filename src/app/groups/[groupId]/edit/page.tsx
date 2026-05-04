import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, desc, eq, notInArray } from "drizzle-orm";
import { BentoPageShell } from "../../../components/bento/bento-page-shell";
import { BentoPageHeader } from "../../../components/bento/bento-page-header";
import { spaceMono } from "../../../components/bento/bento-fonts";
import {
  getGroup,
  getGroupActivities,
} from "../../data";
import { GroupCoverUploader } from "../../group-cover-uploader";
import {
  GroupActivityPicker,
  type PickableActivity,
} from "../../group-activity-picker";
import { GroupDetailsForm } from "../../group-details-form";
import { GroupDeleteButton } from "../../group-delete-button";
import { GroupMemberRemoveButton } from "../../group-member-remove-button";
import {
  formatDistanceAuto,
  formatDateLabel,
} from "@/lib/activity-format";

const PICKER_LIMIT = 1000;

function toDateInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { groupId } = await params;
  const group = await getGroup(userId, groupId);
  if (!group) notFound();

  const members = await getGroupActivities(userId, groupId);

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
        section="Gruppe bearbeiten"
        title={group.name}
        right={
          <div className="flex items-center gap-3">
            <Link
              href={`/groups/${group.id}`}
              className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
            >
              ← Zur Gruppe
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <GroupDetailsForm
          groupId={group.id}
          initial={{
            name: group.name,
            description: group.description,
            startDate: toDateInput(group.startDate),
            endDate: toDateInput(group.endDate),
          }}
        />

        <div className="space-y-3 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-6">
          <h2
            className={`${spaceMono.className} text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
          >
            Cover
          </h2>
          <GroupCoverUploader
            groupId={group.id}
            initialUrl={group.coverPhotoPath}
            initialOffsetX={group.coverOffsetX}
            initialOffsetY={group.coverOffsetY}
          />
        </div>
      </div>

      <section className="space-y-3 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-6">
        <h2
          className={`${spaceMono.className} text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
        >
          Aktivitäten in dieser Gruppe ({members.length})
        </h2>

        {members.length === 0 ? (
          <p className="text-sm text-[#a3a3a3]">
            Noch keine Aktivitäten zugeordnet.
          </p>
        ) : (
          <ul className="divide-y divide-[#1a1a1a] rounded-md border border-[#1a1a1a]">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white">{m.name}</div>
                  <div
                    className={`${spaceMono.className} flex flex-wrap items-center gap-x-3 text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]`}
                  >
                    <span>{m.type}</span>
                    <span>{formatDateLabel(m.startTime)}</span>
                    {m.distance ? (
                      <span>{formatDistanceAuto(m.distance, 1)}</span>
                    ) : null}
                  </div>
                </div>
                <GroupMemberRemoveButton
                  groupId={group.id}
                  activityId={m.id}
                  activityName={m.name}
                />
              </li>
            ))}
          </ul>
        )}

        <GroupActivityPicker
          groupId={group.id}
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
          Die Gruppe wird unwiderruflich gelöscht. Die zugeordneten Aktivitäten
          bleiben erhalten.
        </p>
        <GroupDeleteButton groupId={group.id} groupName={group.name} />
      </section>
    </BentoPageShell>
  );
}
