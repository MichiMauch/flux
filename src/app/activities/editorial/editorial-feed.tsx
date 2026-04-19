"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";
import { rajdhani, spaceMono } from "../../components/bento/bento-fonts";
import { loadMoreActivities, type ActivityFeedItem } from "../actions";
import { EditorialCard, type CardSize } from "./editorial-card";

interface Props {
  initial: ActivityFeedItem[];
  initialHasMore: boolean;
  sport: string | null;
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

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): { month: string; year: string } {
  const [y, m] = key.split("-");
  return { month: MONTH_LABELS_DE[parseInt(m, 10) - 1] ?? "", year: y };
}

function sizeFor(distance: number | null): CardSize {
  if (distance != null && distance >= 10000) return "hero";
  if (distance != null && distance >= 5000) return "medium";
  return "small";
}

function spanFor(size: CardSize): string {
  // 12-col grid, natural flow (no dense packing → gaps allowed)
  if (size === "hero") return "md:col-span-12";
  if (size === "medium") return "md:col-span-7";
  return "md:col-span-5";
}

export function EditorialFeed({ initial, initialHasMore, sport }: Props) {
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
      { rootMargin: "600px 0px" }
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
      <div className="flex flex-col items-center justify-center py-24 text-[#a3a3a3]">
        <ActivityIcon className="h-12 w-12 mb-4" />
        <p
          className={`${spaceMono.className} text-lg font-bold uppercase tracking-[0.18em]`}
        >
          {sport
            ? "Keine Aktivitäten für diesen Filter"
            : "Noch keine Aktivitäten"}
        </p>
        {sport && (
          <Link
            href="/activities/editorial"
            className={`${spaceMono.className} mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3] transition hover:border-[#4a4a4a] hover:text-white`}
          >
            Filter zurücksetzen
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{editorialCss}</style>

      <div className="space-y-20">
        {grouped.map((group, gi) => {
          const { month, year } = monthLabel(group.key);
          let idxInMonth = 0;
          return (
            <section
              key={group.key}
              id={`month-${group.key}`}
              data-month-anchor={group.key}
              className="scroll-mt-24"
            >
              <header
                className={`${rajdhani.className} relative mb-8 select-none`}
                aria-label={`${month} ${year}`}
              >
                <div
                  className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.32em]`}
                  style={{ color: "#6a6a6a" }}
                >
                  <span style={{ color: "#FF6A00" }}>━━</span>{" "}
                  {String(gi + 1).padStart(2, "0")} · {group.items.length}{" "}
                  {group.items.length === 1 ? "EINTRAG" : "EINTRÄGE"}
                </div>
                <h2
                  className="font-bold uppercase leading-[0.82] tracking-[-0.04em] mt-2"
                  style={{
                    fontSize: "clamp(64px, 14vw, 200px)",
                    color: "#1f1f1f",
                    WebkitTextStroke: "1px #3a3a3a",
                  }}
                >
                  {month}
                  <span
                    className="ml-4 align-top"
                    style={{
                      fontSize: "0.35em",
                      color: "#5a5a5a",
                      WebkitTextStroke: "0",
                    }}
                  >
                    {year}
                  </span>
                </h2>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6">
                {group.items.map((a) => {
                  const size = sizeFor(a.distance);
                  const span = spanFor(size);
                  const mirror =
                    size === "hero" ? false : idxInMonth % 2 === 1;
                  const reveal = idxInMonth;
                  idxInMonth += 1;
                  return (
                    <div key={a.id} className={`${span} col-span-1`}>
                      <EditorialCard
                        a={a}
                        size={size}
                        mirror={mirror}
                        revealIndex={reveal}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {hasMore && (
          <div
            ref={sentinelRef}
            className={`${spaceMono.className} flex justify-center py-16 text-[10px] font-bold uppercase tracking-[0.26em] text-[#a3a3a3]`}
          >
            {loading ? "Lade weitere Einträge…" : "Scrolle für mehr"}
          </div>
        )}
      </div>
    </>
  );
}

const editorialCss = `
  .editorial-card [data-reveal-index] .reveal {
    opacity: 0;
    transform: translateY(24px);
    transition:
      opacity 700ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .editorial-card [data-reveal-index][data-in-view="true"] .reveal {
    opacity: 1;
    transform: translateY(0);
  }
  .editorial-card [data-reveal-index][data-in-view="true"] .reveal-1 { transition-delay: 80ms; }
  .editorial-card [data-reveal-index][data-in-view="true"] .reveal-2 { transition-delay: 220ms; }
  .editorial-card [data-reveal-index][data-in-view="true"] .reveal-3 { transition-delay: 380ms; }

  .editorial-card .route-svg {
    transition: transform 400ms cubic-bezier(0.22, 1, 0.36, 1), filter 400ms ease;
  }
  .editorial-card a:hover .route-svg {
    transform: scale(1.03);
    filter:
      drop-shadow(0 0 14px color-mix(in srgb, var(--sport) 80%, transparent))
      drop-shadow(0 0 36px color-mix(in srgb, var(--sport) 60%, transparent));
  }
  .editorial-card a {
    transition: border-color 220ms ease, transform 220ms ease, box-shadow 220ms ease;
  }
  .editorial-card a:hover {
    border-color: color-mix(in srgb, var(--sport) 55%, #242424) !important;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6),
      0 0 0 1px color-mix(in srgb, var(--sport) 25%, transparent);
  }

  .editorial-card .hover-only {
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 240ms ease, transform 240ms ease;
  }
  .editorial-card a:hover .hover-only {
    opacity: 1;
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .editorial-card [data-reveal-index] .reveal,
    .editorial-card [data-reveal-index][data-in-view="true"] .reveal {
      opacity: 1;
      transform: none;
      transition: none;
    }
    .editorial-card .route-svg { transition: none; }
    .editorial-card .hover-only { opacity: 1; transform: none; }
  }
`;
