import Link from "next/link";
import { spaceMono } from "../components/bento/bento-fonts";

interface Props {
  tourId: string;
  current: "date" | "manual";
}

/**
 * Renders a small two-button group above the activities list. Clicking a
 * button navigates to the same page with `?sort=` set, which the server
 * component reads to decide ordering. Only mounted when the tour has at
 * least one member with a saved manual position.
 */
export function TourSortToggle({ tourId, current }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`${spaceMono.className} text-[10px] uppercase tracking-[0.14em] text-[#7a7a7a]`}
      >
        Reihenfolge
      </span>
      <div
        role="group"
        className="inline-flex overflow-hidden rounded-md border border-[#2a2a2a]"
      >
        <Toggle
          href={`/tours/${tourId}?sort=date`}
          active={current === "date"}
          label="Nach Datum"
        />
        <Toggle
          href={`/tours/${tourId}?sort=manual`}
          active={current === "manual"}
          label="Manuell"
        />
      </div>
    </div>
  );
}

function Toggle({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  const cls = active
    ? "bg-[#ff6a00] text-black"
    : "bg-transparent text-[#a3a3a3] hover:text-white";
  return (
    <Link
      href={href}
      scroll={false}
      className={`${spaceMono.className} ${cls} px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em]`}
    >
      {label}
    </Link>
  );
}
