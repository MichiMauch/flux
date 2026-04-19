import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";
import { spaceMono } from "../components/bento/bento-fonts";

interface Props {
  sport: string | null;
  /** Link target for the "Filter zurücksetzen" button. Defaults to /activities. */
  resetHref?: string;
  /** Show Polar-sync hint when no sport filter is active. Defaults to true. */
  showPolarHint?: boolean;
  /** compact = tighter padding/tracking; editorial = roomier. */
  variant?: "compact" | "editorial";
}

export function ActivitiesEmptyState({
  sport,
  resetHref = "/activities",
  showPolarHint = true,
  variant = "compact",
}: Props) {
  const padY = variant === "editorial" ? "py-24" : "py-20";
  const labelTracking =
    variant === "editorial" ? "tracking-[0.18em]" : "tracking-[0.14em]";
  const resetTracking =
    variant === "editorial" ? "tracking-[0.18em]" : "tracking-[0.14em]";
  const hoverBorder =
    variant === "editorial" ? "hover:border-[#4a4a4a]" : "hover:border-[#FF6A0077]";
  return (
    <div className={`flex flex-col items-center justify-center ${padY} text-[#a3a3a3]`}>
      <ActivityIcon className="h-12 w-12 mb-4" />
      <p
        className={`${spaceMono.className} text-lg font-bold uppercase ${labelTracking}`}
      >
        {sport
          ? "Keine Aktivitäten für diesen Filter"
          : "Noch keine Aktivitäten"}
      </p>
      {sport ? (
        <Link
          href={resetHref}
          className={`${spaceMono.className} mt-3 inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5 text-[10px] font-bold uppercase ${resetTracking} text-[#a3a3a3] transition ${hoverBorder} hover:text-white`}
        >
          Filter zurücksetzen
        </Link>
      ) : showPolarHint ? (
        <p className={`${spaceMono.className} text-sm mt-1`}>
          Verbinde deinen Polar-Account, um Aktivitäten zu synchronisieren.
        </p>
      ) : null}
    </div>
  );
}
