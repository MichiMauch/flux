import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BentoPageShell } from "../../components/bento/bento-page-shell";
import { BentoPageHeader } from "../../components/bento/bento-page-header";
import { spaceMono } from "../../components/bento/bento-fonts";
import { MultiRouteMapSection } from "../../components/multi-route-map-section";
import type { MultiRouteEntry } from "../../components/multi-route-map-client";
import {
  getGroup,
  getGroupTotals,
  getGroupActivities,
} from "../data";
import {
  formatDistanceAuto,
  formatDurationWordsSpaced,
  formatDateLabel,
  formatTimeLabel,
} from "@/lib/activity-format";
import { sportColor } from "@/lib/sport-colors";

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
    }));

  const dateRange = (() => {
    const start = group.startDate ?? totals?.startDate ?? null;
    const end = group.endDate ?? totals?.endDate ?? null;
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
  })();

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Aktivitäten" value={String(totals?.count ?? 0)} />
        <Kpi
          label="Distanz"
          value={formatDistanceAuto(totals?.totalDistance ?? 0, 1)}
        />
        <Kpi
          label="Höhenmeter"
          value={`${Math.round(totals?.totalAscent ?? 0)} m`}
        />
        <Kpi
          label="Bewegungszeit"
          value={
            totals?.totalMovingTime
              ? formatDurationWordsSpaced(totals.totalMovingTime)
              : "—"
          }
        />
      </div>

      <div
        className={`${spaceMono.className} text-[11px] uppercase tracking-[0.14em] text-[#a3a3a3]`}
      >
        {dateRange}
      </div>

      {routes.length > 0 ? (
        <div className="h-[420px] overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#0a0a0a]">
          <MultiRouteMapSection routes={routes} />
        </div>
      ) : null}

      <section className="space-y-2">
        <h2
          className={`${spaceMono.className} text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
        >
          Aktivitäten ({members.length})
        </h2>
        {members.length === 0 ? (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-6 text-center text-sm text-[#a3a3a3]">
            Noch keine Aktivitäten zugeordnet.{" "}
            <Link
              href={`/groups/${group.id}/edit`}
              className="text-[#ff6a00] hover:underline"
            >
              Aktivitäten hinzufügen
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[#1a1a1a] rounded-xl border border-[#2a2a2a] bg-[#0a0a0a]">
            {members.map((m, idx) => {
              const color = sportColor(m.type, idx);
              return (
                <li key={m.id}>
                  <Link
                    href={`/activity/${m.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-[#111]"
                  >
                    <span
                      className="h-3 w-1 shrink-0 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-white">
                        {m.name}
                      </div>
                      <div
                        className={`${spaceMono.className} flex flex-wrap items-center gap-x-3 text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]`}
                      >
                        <span>{formatDateLabel(m.startTime)}</span>
                        <span>{formatTimeLabel(m.startTime)}</span>
                        {m.distance ? (
                          <span>{formatDistanceAuto(m.distance, 1)}</span>
                        ) : null}
                        {m.movingTime ? (
                          <span>
                            {formatDurationWordsSpaced(m.movingTime)}
                          </span>
                        ) : null}
                        {m.ascent ? (
                          <span>{Math.round(m.ascent)} m ↑</span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </BentoPageShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-4">
      <div
        className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
      >
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
