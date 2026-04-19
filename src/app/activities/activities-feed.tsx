"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity as ActivityIcon } from "lucide-react";
import Link from "next/link";
import { spaceMono } from "../components/bento/bento-fonts";
import { loadMoreActivities, type ActivityFeedItem } from "./actions";
import { ActivityListRow } from "./activity-list-row";
import { ActivityMonthHeader } from "./activity-month-header";

interface ActivitiesFeedProps {
  initial: ActivityFeedItem[];
  initialHasMore: boolean;
  sport: string | null;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
        .activity-list-row {
          transition: border-color 160ms ease, box-shadow 200ms ease, transform 200ms ease;
        }
        .activity-list-row:hover {
          border-color: var(--sport-color) !important;
          box-shadow:
            0 0 18px color-mix(in srgb, var(--sport-color) 40%, transparent),
            0 0 40px color-mix(in srgb, var(--sport-color) 18%, transparent);
          transform: translateY(-1px);
        }
      `}</style>
      <div className="space-y-8">
        {grouped.map((group, gi) => (
          <section
            key={group.key}
            id={`month-${group.key}`}
            data-month-anchor={group.key}
            className="scroll-mt-24"
          >
            <ActivityMonthHeader
              monthKey={group.key}
              index={gi}
              count={group.items.length}
              variant="compact"
            />
            <div className="flex flex-col gap-2">
              {group.items.map((a) => (
                <ActivityListRow key={a.id} {...a} />
              ))}
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

