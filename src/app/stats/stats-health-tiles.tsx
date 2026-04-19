import { BentoTile } from "../components/bento/bento-tile";
import { LineScope, type LinePoint } from "../components/stats/line-scope";
import {
  MultiLineScope,
  type MultiSeries,
} from "../components/stats/multi-line-scope";
import { BarsScope, type BarPoint } from "../components/stats/bars-scope";
import { DonutScope, type DonutSlice } from "../components/stats/donut-scope";
import { CYAN, GREEN, YELLOW } from "@/lib/sport-colors";

interface Props {
  sleepLine: LinePoint[];
  sleepPhases: DonutSlice[];
  avgSleepCenter: string;
  recoveryLabels: string[];
  recoverySeries: MultiSeries[];
  weightLine: LinePoint[];
  bpLabels: string[];
  bpSeries: MultiSeries[];
  stepsBars: BarPoint[];
  stepsTitle: string;
}

export function StatsHealthTiles({
  sleepLine,
  sleepPhases,
  avgSleepCenter,
  recoveryLabels,
  recoverySeries,
  weightLine,
  bpLabels,
  bpSeries,
  stepsBars,
  stepsTitle,
}: Props) {
  return (
    <>
      <div className="md:col-span-4">
        <BentoTile label="Schlaf" title="Score-Verlauf">
          <LineScope
            points={sleepLine}
            color={CYAN}
            unit="Score"
            height={200}
            minY={0}
            maxY={100}
            yTickStep={25}
            emptyLabel="Keine Schlafdaten im Zeitraum"
          />
        </BentoTile>
      </div>

      <div className="md:col-span-2">
        <BentoTile label="Schlaf" title="Phasen (Ø)">
          <DonutScope
            slices={sleepPhases}
            centerLabel="Ø Schlaf"
            centerValue={avgSleepCenter}
            unit="h:mm"
            size={320}
            emptyLabel="Keine Schlafdaten"
          />
        </BentoTile>
      </div>

      <div className="md:col-span-6">
        <BentoTile label="Recovery" title="HRV & ANS Charge">
          <MultiLineScope
            labels={recoveryLabels}
            series={recoverySeries}
            height={200}
            emptyLabel="Keine Nightly-Recharge-Daten im Zeitraum"
          />
        </BentoTile>
      </div>

      <div className="md:col-span-6">
        <BentoTile label="Gewicht" title="Verlauf">
          <LineScope
            points={weightLine}
            color={GREEN}
            unit="kg"
            height={200}
            emptyLabel="Keine Gewichtsdaten im Zeitraum"
          />
        </BentoTile>
      </div>

      <div className="md:col-span-6">
        <BentoTile label="Blutdruck" title="Sys / Dia / Puls">
          <MultiLineScope
            labels={bpLabels}
            series={bpSeries}
            height={200}
            emptyLabel="Keine Blutdruck-Daten im Zeitraum"
          />
        </BentoTile>
      </div>

      <div className="md:col-span-6">
        <BentoTile label="Tagesaktivität" title={stepsTitle}>
          <BarsScope
            bars={stepsBars}
            color={YELLOW}
            unit=""
            height={180}
            emptyLabel="Keine Tagesaktivität-Daten im Zeitraum"
          />
        </BentoTile>
      </div>
    </>
  );
}
