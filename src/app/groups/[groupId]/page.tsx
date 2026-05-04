import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BentoPageShell } from "../../components/bento/bento-page-shell";
import { BentoPageHeader } from "../../components/bento/bento-page-header";
import { spaceMono } from "../../components/bento/bento-fonts";
import { BentoGroupStats } from "../../components/bento/groups/bento-group-stats";
import { BentoGroupMap } from "../../components/bento/groups/bento-group-map";
import { BentoGroupActivities } from "../../components/bento/groups/bento-group-activities";
import type { MultiRouteEntry } from "../../components/multi-route-map-client";
import { getGroup, getGroupTotals, getGroupActivities } from "../data";

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

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { groupId } = await params;
  const [group, totals, members] = await Promise.all([
    getGroup(userId, groupId),
    getGroupTotals(userId, groupId),
    getGroupActivities(userId, groupId),
  ]);

  if (!group) notFound();

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
    group.startDate ?? totals?.startDate ?? null,
    group.endDate ?? totals?.endDate ?? null
  );

  return (
    <BentoPageShell>
      <BentoPageHeader
        section="Gruppe"
        title={group.name}
        right={
          <div className="flex items-center gap-3">
            <Link
              href={`/groups/${group.id}/edit`}
              className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
            >
              Bearbeiten
            </Link>
            <Link
              href="/groups"
              className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
            >
              ← Übersicht
            </Link>
          </div>
        }
      />

      {group.coverPhotoPath ? (
        <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl border border-[#2a2a2a]">
          <Image
            src={group.coverPhotoPath}
            alt={group.name}
            fill
            sizes="(min-width: 1280px) 1280px, 100vw"
            priority
            className="object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
          {group.description ? (
            <div className="absolute inset-x-0 bottom-0 p-5 text-sm text-white">
              {group.description}
            </div>
          ) : null}
        </div>
      ) : group.description ? (
        <p className="text-sm text-[#a3a3a3]">{group.description}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        <BentoGroupStats totals={totals} dateRangeLabel={dateRangeLabel} />
        <BentoGroupMap routes={routes} />
        <BentoGroupActivities members={members} groupId={group.id} />
      </div>
    </BentoPageShell>
  );
}
