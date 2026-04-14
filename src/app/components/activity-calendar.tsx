"use client";

import Link from "next/link";
import { ActivityLottie } from "./activity-lottie";
import { activityTypeColor } from "@/lib/activity-types";
import { dayKey } from "@/lib/activity-week";

interface CalendarEntry {
  id: string;
  type: string;
  name: string;
  distanceKm: number | null;
}

interface ActivityCalendarProps {
  year: number;
  month: number; // 0-based
  byDay: Record<string, CalendarEntry[]>;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function ActivityCalendar({ year, month, byDay }: ActivityCalendarProps) {
  // Build 6-week grid starting from Monday before/at day 1
  const first = new Date(year, month, 1);
  const firstDayOfWeek = (first.getDay() + 6) % 7; // Mon=0
  const gridStart = new Date(year, month, 1 - firstDayOfWeek);

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border bg-surface/60">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground py-2"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const key = dayKey(d);
          const entries = byDay[key] ?? [];
          const inMonth = d.getMonth() === month;
          const isToday = d.getTime() === today.getTime();
          const isWeekEnd = (i + 1) % 7 === 0;
          const isLastRow = i >= 35;
          return (
            <div
              key={key}
              className={`min-h-[84px] sm:min-h-[104px] p-1.5 border-border flex flex-col gap-1 ${
                isWeekEnd ? "" : "border-r"
              } ${isLastRow ? "" : "border-b"} ${
                inMonth ? "bg-background" : "bg-surface/30"
              }`}
            >
              <div
                className={`text-[11px] font-semibold tabular-nums leading-none ${
                  !inMonth
                    ? "text-muted-foreground/60"
                    : isToday
                      ? "text-brand"
                      : "text-foreground"
                }`}
              >
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white">
                    {d.getDate()}
                  </span>
                ) : (
                  d.getDate()
                )}
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                {entries.map((e) => (
                  <Link
                    key={e.id}
                    href={`/activity/${e.id}`}
                    className="flex items-center gap-1 rounded-sm px-1 py-0.5 hover:bg-surface min-w-0"
                  >
                    <span
                      className="w-1 h-4 rounded-sm flex-shrink-0"
                      style={{ background: activityTypeColor(e.type) }}
                    />
                    <span className="flex-shrink-0 w-6 h-6 -ml-0.5">
                      <ActivityLottie activityType={e.type} activityName={e.name} size={24} />
                    </span>
                    {e.distanceKm != null && e.distanceKm > 0 && (
                      <span className="text-[10px] font-semibold tabular-nums truncate">
                        {e.distanceKm.toFixed(1)}
                        <span className="text-muted-foreground font-normal ml-0.5">km</span>
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
