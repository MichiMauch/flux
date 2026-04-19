"use client";

import Link from "next/link";
import { ActivityLottie } from "./activity-lottie";
import { activityTypeColor } from "@/lib/activity-types";
import { dayKey } from "@/lib/activity-week";
import { formatDurationHmSplit } from "@/lib/activity-format";
import { SevenSegDisplay } from "./bento/seven-seg";
import { spaceMono } from "./bento/bento-fonts";

interface CalendarEntry {
  id: string;
  type: string;
  name: string;
  distanceKm: number | null;
  durationSec: number | null;
}

interface ActivityCalendarProps {
  year: number;
  month: number; // 0-based
  byDay: Record<string, CalendarEntry[]>;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKS = 6;

export function ActivityCalendar({ year, month, byDay }: ActivityCalendarProps) {
  // Build 6-week grid starting from Monday before/at day 1
  const first = new Date(year, month, 1);
  const firstDayOfWeek = (first.getDay() + 6) % 7; // Mon=0
  const gridStart = new Date(year, month, 1 - firstDayOfWeek);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weeks: Date[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + w * 7 + i);
      days.push(d);
    }
    weeks.push(days);
  }

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-black/40 overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.6fr)] border-b border-[#2a2a2a] bg-black/60">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[#d0c5ba] py-2"
          >
            {w}
          </div>
        ))}
        <div className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A00] py-2 border-l border-[#2a2a2a]">
          Σ Woche
        </div>
      </div>

      {/* Days */}
      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.6fr)]">
        {weeks.map((days, wIdx) => {
          const isLastRow = wIdx === WEEKS - 1;
          let count = 0;
          let distanceKm = 0;
          let durationSec = 0;
          for (const d of days) {
            const entries = byDay[dayKey(d)] ?? [];
            for (const e of entries) {
              count += 1;
              distanceKm += e.distanceKm ?? 0;
              durationSec += e.durationSec ?? 0;
            }
          }
          const dur = durationSec > 0 ? formatDurationHmSplit(durationSec) : null;

          return (
            <div key={wIdx} className="contents">
              {days.map((d, i) => {
                const key = dayKey(d);
                const entries = byDay[key] ?? [];
                const inMonth = d.getMonth() === month;
                const isToday = d.getTime() === today.getTime();
                return (
                  <div
                    key={key}
                    className={`min-h-[84px] sm:min-h-[104px] p-1.5 border-r border-[#2a2a2a] flex flex-col gap-1 ${
                      isLastRow ? "" : "border-b"
                    } ${inMonth ? "bg-[#0f0f0f]" : "bg-black/80"}`}
                  >
                    <div
                      className={`text-[11px] font-semibold tabular-nums leading-none ${
                        !inMonth
                          ? "text-[#5a5149]"
                          : isToday
                            ? "text-[#FF6A00]"
                            : "text-white"
                      }`}
                    >
                      {isToday ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#FF6A00] text-black font-bold">
                          {d.getDate()}
                        </span>
                      ) : (
                        d.getDate()
                      )}
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                      {entries.map((e) => {
                        const color = activityTypeColor(e.type);
                        return (
                          <Link
                            key={e.id}
                            href={`/activity/${e.id}`}
                            className="flex items-center gap-1 rounded-sm px-1 py-0.5 hover:bg-black/60 min-w-0"
                          >
                            <span
                              className="w-1 h-4 rounded-sm flex-shrink-0"
                              style={{ background: color }}
                            />
                            <span className="flex-shrink-0 w-6 h-6 -ml-0.5">
                              <ActivityLottie
                                activityType={e.type}
                                activityName={e.name}
                                size={24}
                                tint={color}
                              />
                            </span>
                            {e.distanceKm != null && e.distanceKm > 0 && (
                              <span className="text-[10px] font-semibold tabular-nums truncate text-white">
                                {e.distanceKm.toFixed(1)}
                                <span className="text-[#9ca3af] font-normal ml-0.5">km</span>
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Weekly totals column */}
              <div
                className={`min-h-[84px] sm:min-h-[104px] px-3 py-2 flex flex-col justify-center gap-2 bg-black/60 ${
                  isLastRow ? "" : "border-b border-[#2a2a2a]"
                }`}
              >
                {count > 0 ? (
                  <>
                    <SumStat value={String(count)} unit="Akt." />
                    <SumStat
                      value={distanceKm > 0 ? distanceKm.toFixed(1) : "-"}
                      unit="km"
                    />
                    <SumStat
                      value={dur ? dur.value : "-"}
                      unit={dur ? dur.unit : ""}
                    />
                  </>
                ) : (
                  <span
                    className={`${spaceMono.className} text-[11px] text-[#5a5149] tabular-nums leading-none`}
                  >
                    –
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SumStat({ value, unit }: { value: string; unit: string }) {
  return (
    <div
      className="flex items-baseline gap-1 leading-none"
      style={{ fontSize: "20px" }}
    >
      <SevenSegDisplay value={value} on="#ffffff" />
      {unit && (
        <span
          className={`${spaceMono.className} font-bold lowercase`}
          style={{ fontSize: "0.5em", color: "#FF6A00" }}
        >
          {unit}
        </span>
      )}
    </div>
  );
}
