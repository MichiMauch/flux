"use client";

import { useMemo } from "react";
import type { ActivityFeedItem } from "./actions";
import { ActivityListRow } from "./activity-list-row";
import { ActivityMonthHeader } from "./activity-month-header";
import { ActivitiesEmptyState } from "./activities-empty-state";
import { ActivitiesLoadMoreSentinel } from "./activities-load-more-sentinel";
import { useInfiniteActivities } from "./use-infinite-activities";

interface ActivitiesFeedProps {
  initial: ActivityFeedItem[];
  initialHasMore: boolean;
  sport: string | null;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const HOVER_CSS = `
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
`;

export function ActivitiesFeed({
  initial,
  initialHasMore,
  sport,
}: ActivitiesFeedProps) {
  const { items, hasMore, loading, sentinelRef } = useInfiniteActivities(
    initial,
    initialHasMore,
    sport
  );

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
    return <ActivitiesEmptyState sport={sport} />;
  }

  return (
    <>
      <style>{HOVER_CSS}</style>
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
          <ActivitiesLoadMoreSentinel
            sentinelRef={sentinelRef}
            loading={loading}
          />
        )}
      </div>
    </>
  );
}
