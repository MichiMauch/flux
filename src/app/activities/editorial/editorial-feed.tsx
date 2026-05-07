"use client";

import { useMemo } from "react";
import type { ActivityFeedItem } from "../actions";
import { ActivitiesEmptyState } from "../activities-empty-state";
import { ActivitiesLoadMoreSentinel } from "../activities-load-more-sentinel";
import { useInfiniteActivities } from "../use-infinite-activities";
import { EDITORIAL_CARD_CSS } from "./editorial-card-styles";
import { EditorialMonthSection } from "./editorial-month-section";

interface Props {
  initial: ActivityFeedItem[];
  initialHasMore: boolean;
  sport: string | null;
  monthKey?: string | null;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function EditorialFeed({
  initial,
  initialHasMore,
  sport,
  monthKey: filterMonthKey = null,
}: Props) {
  const { items, hasMore, loading, sentinelRef } = useInfiniteActivities(
    initial,
    initialHasMore,
    sport,
    filterMonthKey,
    "600px 0px"
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
    return (
      <ActivitiesEmptyState
        sport={sport}
        resetHref="/activities"
        showPolarHint={false}
        variant="editorial"
      />
    );
  }

  return (
    <>
      <style>{EDITORIAL_CARD_CSS}</style>

      <div className="space-y-20">
        {grouped.map((group, gi) => (
          <EditorialMonthSection
            key={group.key}
            monthKey={group.key}
            index={gi}
            items={group.items}
          />
        ))}

        {hasMore && (
          <ActivitiesLoadMoreSentinel
            sentinelRef={sentinelRef}
            loading={loading}
            loadingLabel="Lade weitere Einträge…"
            tracking="wider"
            paddingY="py-16"
          />
        )}
      </div>
    </>
  );
}
