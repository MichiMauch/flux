import Link from "next/link";
import { BentoTile } from "../bento-tile";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";
import {
  formatDistanceAuto,
  formatDistanceKm,
  formatDurationHmSplit,
  formatDurationWordsSpaced,
  formatDateLabel,
  formatTimeLabel,
} from "@/lib/activity-format";
import { sportColor, NEON } from "@/lib/sport-colors";
import type { TourActivity } from "@/app/tours/data";

interface BentoTourActivitiesProps {
  members: TourActivity[];
  tourId: string;
  /** When false, activity entries are non-clickable (e.g. public share view). */
  interactive?: boolean;
}

export function BentoTourActivities({
  members,
  tourId,
  interactive = true,
}: BentoTourActivitiesProps) {
  return (
    <BentoTile
      label="Aktivitäten"
      title={`${members.length} ${members.length === 1 ? "Aktivität" : "Aktivitäten"}`}
      padding="none"
    >
      {members.length === 0 ? (
        <div className="p-6 text-center text-sm text-[#a3a3a3]">
          {interactive ? (
            <>
              Noch keine Aktivitäten zugeordnet.{" "}
              <Link
                href={`/tours/${tourId}/edit`}
                className="text-[#ff6a00] hover:underline"
              >
                Aktivitäten hinzufügen
              </Link>
            </>
          ) : (
            "Noch keine Aktivitäten zugeordnet."
          )}
        </div>
      ) : (
        <div className="grid gap-px border-t border-[#2a2a2a] bg-[#1a1a1a] md:grid-cols-2">
          {members.map((m, idx) => {
            const color = sportColor(m.type, idx);
            const rowClass = `flex items-stretch gap-3 bg-[#0f0f0f] p-3 md:gap-4 md:p-5${interactive ? " transition-colors hover:bg-[#161616]" : ""}`;
            const inner = (
              <>
                <span
                  key="bar"
                  className="w-1 shrink-0 self-stretch rounded-sm md:w-1.5"
                  style={{ backgroundColor: color }}
                />
                <div key="body" className="min-w-0 flex-1 space-y-1 md:space-y-2">
                  <div className="line-clamp-2 text-sm leading-tight text-white md:text-base md:font-medium">
                    {m.name}
                  </div>

                  <div
                    className={`${spaceMono.className} flex flex-wrap items-center gap-x-3 text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3] md:hidden`}
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

                  <div
                    className={`${spaceMono.className} hidden text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3] md:block`}
                  >
                    {formatDateLabel(m.startTime)} ·{" "}
                    {formatTimeLabel(m.startTime)}
                  </div>

                  <div
                    className="hidden flex-wrap items-baseline gap-x-5 gap-y-1 leading-none md:flex"
                    style={{ fontSize: "22px" }}
                  >
                    {m.distance != null ? (
                      <Led value={formatDistanceKm(m.distance, 1)} unit="km" />
                    ) : null}
                    {m.movingTime != null
                      ? (() => {
                          const d = formatDurationHmSplit(m.movingTime);
                          return <Led value={d.value} unit={d.unit} />;
                        })()
                      : null}
                    {m.ascent != null ? (
                      <Led value={String(Math.round(m.ascent))} unit="m ↑" />
                    ) : null}
                  </div>
                </div>
              </>
            );
            return interactive ? (
              <Link key={m.id} href={`/activity/${m.id}`} className={rowClass}>
                {inner}
              </Link>
            ) : (
              <div key={m.id} className={rowClass}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </BentoTile>
  );
}

function Led({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="flex items-baseline gap-1 leading-none">
      <SevenSegDisplay value={value} />
      <span
        className={`${spaceMono.className} text-[0.45em] font-bold lowercase`}
        style={{ color: NEON }}
      >
        {unit}
      </span>
    </div>
  );
}
