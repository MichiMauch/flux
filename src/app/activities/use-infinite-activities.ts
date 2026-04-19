"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadMoreActivities, type ActivityFeedItem } from "./actions";

export function useInfiniteActivities(
  initial: ActivityFeedItem[],
  initialHasMore: boolean,
  sport: string | null,
  rootMargin: string = "400px 0px"
) {
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
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore, rootMargin]);

  return { items, hasMore, loading, sentinelRef };
}
