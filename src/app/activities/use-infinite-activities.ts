"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadMoreActivities, type ActivityFeedItem } from "./actions";

export const SCROLL_TO_MONTH_EVENT = "flux:scroll-to-month";

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

  // Jump-to-month: timeline ribbon dispatches a window event when a chip is
  // tapped. If the target month section isn't rendered yet (initial page load
  // shows only ~20 items), keep loading more until it appears, then scroll.
  const hasMoreRef = useRef(hasMore);
  const loadMoreRef = useRef(loadMore);
  const itemsLenRef = useRef(items.length);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);
  useEffect(() => {
    itemsLenRef.current = items.length;
  }, [items.length]);

  useEffect(() => {
    let cancelled = false;
    const findAnchor = (key: string) =>
      document.querySelector<HTMLElement>(`[data-month-anchor="${key}"]`);

    const waitForGrowth = (before: number) =>
      new Promise<void>((resolve) => {
        const start = Date.now();
        const check = () => {
          if (cancelled) return resolve();
          if (itemsLenRef.current !== before) return resolve();
          if (Date.now() - start > 2000) return resolve();
          requestAnimationFrame(check);
        };
        check();
      });

    const handler = async (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      if (!key) return;

      const existing = findAnchor(key);
      if (existing) {
        existing.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      let safety = 30;
      while (!cancelled && hasMoreRef.current && safety-- > 0) {
        const before = itemsLenRef.current;
        await loadMoreRef.current();
        await waitForGrowth(before);
        const found = findAnchor(key);
        if (found) {
          found.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }
    };

    window.addEventListener(SCROLL_TO_MONTH_EVENT, handler as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener(
        SCROLL_TO_MONTH_EVENT,
        handler as EventListener
      );
    };
  }, []);

  return { items, hasMore, loading, sentinelRef };
}
