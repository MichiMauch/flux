import Link from "next/link";
import { BentoTile } from "../bento-tile";
import { spaceMono } from "../bento-fonts";
import {
  formatDistanceAuto,
  formatDurationWordsSpaced,
  formatDateLabel,
  formatTimeLabel,
} from "@/lib/activity-format";
import { sportColor } from "@/lib/sport-colors";
import type { GroupActivity } from "@/app/groups/data";

interface BentoGroupActivitiesProps {
  members: GroupActivity[];
  groupId: string;
}

export function BentoGroupActivities({
  members,
  groupId,
}: BentoGroupActivitiesProps) {
  return (
    <BentoTile
      label="Aktivitäten"
      title={`${members.length} ${members.length === 1 ? "Aktivität" : "Aktivitäten"}`}
      padding="none"
    >
      {members.length === 0 ? (
        <div className="p-6 text-center text-sm text-[#a3a3a3]">
          Noch keine Aktivitäten zugeordnet.{" "}
          <Link
            href={`/groups/${groupId}/edit`}
            className="text-[#ff6a00] hover:underline"
          >
            Aktivitäten hinzufügen
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[#1a1a1a] border-t border-[#2a2a2a]">
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
                    <div className="truncate text-sm text-white">{m.name}</div>
                    <div
                      className={`${spaceMono.className} flex flex-wrap items-center gap-x-3 text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]`}
                    >
                      <span>{formatDateLabel(m.startTime)}</span>
                      <span>{formatTimeLabel(m.startTime)}</span>
                      {m.distance ? (
                        <span>{formatDistanceAuto(m.distance, 1)}</span>
                      ) : null}
                      {m.movingTime ? (
                        <span>{formatDurationWordsSpaced(m.movingTime)}</span>
                      ) : null}
                      {m.ascent ? <span>{Math.round(m.ascent)} m ↑</span> : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </BentoTile>
  );
}
