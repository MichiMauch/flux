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
import {
  updateGroup,
  deleteGroup,
  removeActivityFromGroup,
} from "../../actions";
import { GroupCoverUploader } from "../../group-cover-uploader";
import {
  GroupActivityPicker,
  type PickableActivity,
} from "../../group-activity-picker";
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

  const updateAction = updateGroup.bind(null, groupId);
  async function deleteAction() {
    "use server";
    await deleteGroup(groupId);
    redirect("/groups");
  }

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
        <form
          action={updateAction}
          className="space-y-5 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-6"
        >
          <h2
            className={`${spaceMono.className} text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
          >
            Details
          </h2>

          <div className="space-y-2">
            <label
              htmlFor="name"
              className={`${spaceMono.className} block text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={120}
              defaultValue={group.name}
              className="w-full rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="description"
              className={`${spaceMono.className} block text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
            >
              Beschreibung
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={group.description ?? ""}
              className="w-full rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label
                htmlFor="startDate"
                className={`${spaceMono.className} block text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
              >
                Start
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={toDateInput(group.startDate)}
                className="w-full rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="endDate"
                className={`${spaceMono.className} block text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
              >
                Ende
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={toDateInput(group.endDate)}
                className="w-full rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className={`${spaceMono.className} inline-flex items-center rounded-md border border-[#ff6a00] bg-[#ff6a00] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-black hover:bg-[#ff8030]`}
            >
              Speichern
            </button>
          </div>
        </form>

        <div className="space-y-3 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-6">
          <h2
            className={`${spaceMono.className} text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
          >
            Cover
          </h2>
          <GroupCoverUploader
            groupId={group.id}
            initialUrl={group.coverPhotoPath}
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
              <li
                key={m.id}
                className="flex items-center gap-3 p-3"
              >
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
                <form
                  action={async () => {
                    "use server";
                    await removeActivityFromGroup(groupId, m.id);
                  }}
                >
                  <button
                    type="submit"
                    className={`${spaceMono.className} inline-flex items-center rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
                  >
                    Entfernen
                  </button>
                </form>
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
        <form action={deleteAction}>
          <button
            type="submit"
            className={`${spaceMono.className} inline-flex items-center rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-red-300 hover:border-red-700 hover:text-red-200`}
          >
            Gruppe löschen
          </button>
        </form>
      </section>
    </BentoPageShell>
  );
}
