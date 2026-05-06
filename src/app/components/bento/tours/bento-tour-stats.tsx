import { BentoTile } from "../bento-tile";
import { spaceMono } from "../bento-fonts";
import {
  formatDistanceAuto,
  formatDurationWordsSpaced,
} from "@/lib/activity-format";
import type { TourTotals } from "@/app/tours/data";

interface BentoTourStatsProps {
  totals: TourTotals | null;
  dateRangeLabel: string;
}

export function BentoTourStats({ totals, dateRangeLabel }: BentoTourStatsProps) {
  return (
    <BentoTile label="Übersicht" title="Kennzahlen">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Aktivitäten" value={String(totals?.count ?? 0)} />
        <Kpi
          label="Distanz"
          value={formatDistanceAuto(totals?.totalDistance ?? 0, 1)}
        />
        <Kpi
          label="Höhenmeter"
          value={`${Math.round(totals?.totalAscent ?? 0)} m`}
        />
        <Kpi
          label="Bewegungszeit"
          value={
            totals?.totalMovingTime
              ? formatDurationWordsSpaced(totals.totalMovingTime)
              : "—"
          }
        />
      </div>
      <div
        className={`${spaceMono.className} mt-3 text-[11px] uppercase tracking-[0.14em] text-[#a3a3a3]`}
      >
        {dateRangeLabel}
      </div>
    </BentoTile>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-3">
      <div
        className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
      >
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
