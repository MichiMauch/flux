"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity as ActivityIcon } from "lucide-react";
import Link from "next/link";
import { BentoHomeFeedCard } from "../components/bento/home/bento-home-feed-card";
import { rajdhani, spaceMono } from "../components/bento/bento-fonts";
import { activityTypeColor } from "@/lib/activity-types";
import { loadMoreActivities, type ActivityFeedItem } from "./actions";

const NEON = "#FF6A00";

interface ActivitiesFeedProps {
  initial: ActivityFeedItem[];
  initialHasMore: boolean;
  sport: string | null;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_LABELS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTH_LABELS_DE[parseInt(m, 10) - 1]} ${y}`;
}

function spanForIndex(index: number, hasRoute: boolean): string {
  if (index === 0 && hasRoute) return "md:col-span-6 md:row-span-2";
  if (index === 0 && !hasRoute) return "md:col-span-3";
  if (hasRoute) return "md:col-span-3";
  return "md:col-span-2";
}

export function ActivitiesFeed({
  initial,
  initialHasMore,
  sport,
}: ActivitiesFeedProps) {
  const [items, setItems] = useState<ActivityFeedItem[]>(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(initial);
    setHasMore(initialHasMore);
  }, [initial, initialHasMore]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await loadMoreActivities(items.length, sport);
      setItems((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, items.length, sport]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore]);

  const grouped = useMemo(() => {
    const map = new Map<string, ActivityFeedItem[]>();
    for (const a of items) {
      const key = monthKey(new Date(a.startTime));
      const bucket = map.get(key) ?? [];
      bucket.push(a);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).map(([key, group]) => ({
      key,
      items: group,
    }));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#a3a3a3]">
        <ActivityIcon className="h-12 w-12 mb-4" />
        <p
          className={`${spaceMono.className} text-lg font-bold uppercase tracking-[0.14em]`}
        >
          {sport ? "Keine Aktivitäten für diesen Filter" : "Noch keine Aktivitäten"}
        </p>
        {sport ? (
          <Link
            href="/activities"
            className={`${spaceMono.className} mt-3 inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] transition hover:border-[#FF6A0077] hover:text-white`}
          >
            Filter zurücksetzen
          </Link>
        ) : (
          <p className={`${spaceMono.className} text-sm mt-1`}>
            Verbinde deinen Polar-Account, um Aktivitäten zu synchronisieren.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{`
        .activity-card-wrap { --sport-color: ${NEON}; }
        .activity-card-wrap > a {
          transition: border-color 160ms ease, box-shadow 200ms ease, transform 200ms ease;
        }
        .activity-card-wrap:hover > a {
          border-color: var(--sport-color) !important;
          box-shadow:
            0 0 18px color-mix(in srgb, var(--sport-color) 45%, transparent),
            0 0 40px color-mix(in srgb, var(--sport-color) 22%, transparent);
          transform: translateY(-1px);
        }
      `}</style>
      <div className="space-y-8">
        {grouped.map((group) => (
          <section
            key={group.key}
            id={`month-${group.key}`}
            data-month-anchor={group.key}
            className="scroll-mt-24"
          >
            <MonthHeader month={group.key} />
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:auto-rows-min md:[grid-auto-flow:row_dense]">
              {group.items.map((a, i) => {
                const hasRoute =
                  Array.isArray(a.routeData) &&
                  (a.routeData as unknown[]).length >= 2;
                const spans = spanForIndex(i, hasRoute);
                const color = activityTypeColor(a.type);
                return (
                  <div
                    key={a.id}
                    className={`activity-card-wrap ${spans}`}
                    style={
                      {
                        ["--sport-color" as string]: color,
                      } as React.CSSProperties
                    }
                  >
                    <BentoHomeFeedCard
                      {...a}
                      hero={i === 0 && hasRoute}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {hasMore && (
          <div
            ref={sentinelRef}
            className={`${spaceMono.className} flex justify-center py-8 text-[10px] font-bold uppercase tracking-[0.22em] text-[#a3a3a3]`}
          >
            {loading ? "Lade..." : "Scrolle für mehr"}
          </div>
        )}
      </div>
    </>
  );
}

function MonthHeader({ month }: { month: string }) {
  return (
    <div className="sticky top-0 z-10 -mx-1 mb-3 flex items-baseline gap-3 border-b border-[#2a2a2a] bg-black/85 px-1 pb-2 pt-1 backdrop-blur">
      <h2
        className={`${rajdhani.className} font-bold uppercase leading-none tracking-[-0.01em]`}
        style={{
          fontSize: "clamp(20px, 2.4vw, 32px)",
          color: NEON,
          textShadow: `0 0 12px ${NEON}66`,
        }}
      >
        {monthLabel(month)}
      </h2>
    </div>
  );
}
