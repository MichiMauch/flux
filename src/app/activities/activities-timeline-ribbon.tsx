"use client";

import { useEffect, useRef, useState } from "react";
import { spaceMono } from "../components/bento/bento-fonts";
import { SCROLL_TO_MONTH_EVENT } from "./use-infinite-activities";

const NEON = "#FF6A00";
const DIM = "#a3a3a3";

interface ActivitiesTimelineRibbonProps {
  months: string[];
}

const MONTH_SHORT_DE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

function chipLabel(key: string): { m: string; y: string } {
  const [y, mo] = key.split("-");
  return {
    m: MONTH_SHORT_DE[parseInt(mo, 10) - 1] ?? "",
    y: y.slice(2),
  };
}

export function ActivitiesTimelineRibbon({
  months,
}: ActivitiesTimelineRibbonProps) {
  const [active, setActive] = useState<string | null>(months[0] ?? null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (months.length === 0) return;

    const visible = new Set<string>();
    const observed = new WeakSet<Element>();

    const intersect = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const key = (e.target as HTMLElement).dataset.monthAnchor;
          if (!key) continue;
          if (e.isIntersecting) visible.add(key);
          else visible.delete(key);
        }
        if (visible.size > 0) {
          const sorted = Array.from(visible).sort().reverse();
          setActive(sorted[0]);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    // Sections are rendered lazily as the user scrolls (or via jump-to-month),
    // so re-scan whenever the DOM changes and observe newly added anchors.
    const scan = () => {
      for (const key of months) {
        const el = document.querySelector<HTMLElement>(
          `[data-month-anchor="${key}"]`
        );
        if (el && !observed.has(el)) {
          observed.add(el);
          intersect.observe(el);
        }
      }
    };
    scan();

    const mut = new MutationObserver(scan);
    mut.observe(document.body, { childList: true, subtree: true });

    return () => {
      intersect.disconnect();
      mut.disconnect();
    };
  }, [months]);

  useEffect(() => {
    if (!active) return;
    const chip = chipRefs.current.get(active);
    const scroller = scrollerRef.current;
    if (!chip || !scroller) return;
    const chipLeft = chip.offsetLeft;
    const chipRight = chipLeft + chip.offsetWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;
    if (chipLeft < viewLeft + 40 || chipRight > viewRight - 40) {
      scroller.scrollTo({
        left: chipLeft - scroller.clientWidth / 2 + chip.offsetWidth / 2,
        behavior: "smooth",
      });
    }
  }, [active]);

  if (months.length === 0) return null;

  const handleClick = (key: string) => {
    setActive(key);
    window.dispatchEvent(
      new CustomEvent(SCROLL_TO_MONTH_EVENT, { detail: key })
    );
  };

  return (
    <div
      className="relative border border-[#2a2a2a] bg-[#0a0a0a] rounded-lg overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent 0%, rgba(255,106,0,0.02) 50%, transparent 100%)",
      }}
    >
      {/* Fade-Gradients zeigen an, dass die Chip-Leiste horizontal scrollt —
          sonst sieht man die angeschnittenen Monats-Chips am Rand nicht als
          Overflow-Hinweis. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-8 z-10 bg-gradient-to-r from-[#0a0a0a] to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-[#0a0a0a] to-transparent"
      />
      <div
        ref={scrollerRef}
        className="flex gap-1 overflow-x-auto px-2 py-2 scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {months.map((key) => {
          const isActive = active === key;
          const { m, y } = chipLabel(key);
          const newYear = key.endsWith("-01");
          return (
            <button
              key={key}
              ref={(el) => {
                if (el) chipRefs.current.set(key, el);
                else chipRefs.current.delete(key);
              }}
              onClick={() => handleClick(key)}
              className={`${spaceMono.className} shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition`}
              style={
                isActive
                  ? {
                      borderColor: NEON,
                      color: NEON,
                      background: "rgba(255,106,0,0.1)",
                      boxShadow: `0 0 8px ${NEON}66`,
                      textShadow: `0 0 4px ${NEON}aa`,
                    }
                  : {
                      borderColor: newYear ? "#4a4a4a" : "#2a2a2a",
                      color: DIM,
                      background: "#0f0f0f",
                    }
              }
              aria-label={`${m} 20${y}`}
            >
              <span className="mr-1">{m}</span>
              <span className={isActive ? "" : "text-[#6a6a6a]"}>'{y}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
