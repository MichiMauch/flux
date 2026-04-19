import { BentoTile } from "../components/bento/bento-tile";
import { BarsScope, type BarPoint } from "../components/stats/bars-scope";
import { DonutScope, type DonutSlice } from "../components/stats/donut-scope";
import { CYAN, NEON } from "@/lib/sport-colors";
import { StatsKpiGrid, type StatsKpi } from "./stats-kpi-grid";

interface Props {
  kpis: StatsKpi[];
  sportSlices: DonutSlice[];
  distanceBars: BarPoint[];
  durationBars: BarPoint[];
  totalDistance: number;
  activityTileLabel: string;
  bucketLabelSuffix: string;
  showSportDonut: boolean;
}

export function StatsActivityTiles({
  kpis,
  sportSlices,
  distanceBars,
  durationBars,
  totalDistance,
  activityTileLabel,
  bucketLabelSuffix,
  showSportDonut,
}: Props) {
  return (
    <>
      <div className={showSportDonut ? "md:col-span-3" : "md:col-span-6"}>
        <BentoTile
          label={activityTileLabel}
          title="Totals"
          className="h-full flex flex-col"
        >
          <StatsKpiGrid kpis={kpis} />
        </BentoTile>
      </div>

      {showSportDonut && (
        <div className="md:col-span-3">
          <BentoTile
            label="Verteilung"
            title="Nach Sportart"
            className="h-full flex flex-col"
          >
            <div className="flex flex-1 w-full items-center">
              <DonutScope
                slices={sportSlices}
                centerLabel="Total"
                centerValue={`${Math.round(totalDistance / 1000)}`}
                unit="km"
                size={480}
              />
            </div>
          </BentoTile>
        </div>
      )}

      <div className="md:col-span-3">
        <BentoTile label={`Verlauf · ${bucketLabelSuffix}`} title="Distanz">
          <BarsScope
            bars={distanceBars}
            color={NEON}
            unit="km"
            height={180}
            emptyLabel="Keine Aktivitäten im Zeitraum"
          />
        </BentoTile>
      </div>

      <div className="md:col-span-3">
        <BentoTile label={`Verlauf · ${bucketLabelSuffix}`} title="Dauer">
          <BarsScope
            bars={durationBars}
            color={CYAN}
            unit="min"
            height={180}
            emptyLabel="Keine Aktivitäten im Zeitraum"
          />
        </BentoTile>
      </div>
    </>
  );
}
