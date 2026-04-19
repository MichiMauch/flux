import type { RefObject } from "react";
import { spaceMono } from "../components/bento/bento-fonts";

interface Props {
  sentinelRef: RefObject<HTMLDivElement | null>;
  loading: boolean;
  /** Label while loading (default: "Lade..."). */
  loadingLabel?: string;
  /** Label when idle (default: "Scrolle für mehr"). */
  idleLabel?: string;
  /** Tracking width. */
  tracking?: "wide" | "wider";
  /** Vertical padding Tailwind class. */
  paddingY?: string;
}

export function ActivitiesLoadMoreSentinel({
  sentinelRef,
  loading,
  loadingLabel = "Lade...",
  idleLabel = "Scrolle für mehr",
  tracking = "wide",
  paddingY = "py-8",
}: Props) {
  const trackingClass =
    tracking === "wider" ? "tracking-[0.26em]" : "tracking-[0.22em]";
  return (
    <div
      ref={sentinelRef}
      className={`${spaceMono.className} flex justify-center ${paddingY} text-[10px] font-bold uppercase ${trackingClass} text-[#a3a3a3]`}
    >
      {loading ? loadingLabel : idleLabel}
    </div>
  );
}
