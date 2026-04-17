import { computeSplits, type HrSample, type RoutePoint } from "@/lib/splits";
import { spaceMono } from "./bento-fonts";
import { SevenSegDisplay } from "./seven-seg";

interface Props {
  routeData: RoutePoint[];
  heartRateData: HrSample[];
  isRunning?: boolean;
  totalDistanceMeters?: number | null;
  totalAscent?: number | null;
  totalDescent?: number | null;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatPace(sec: number | null): string {
  if (sec == null || !isFinite(sec)) return "–";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSpeed(sec: number | null): string {
  if (sec == null || !isFinite(sec) || sec <= 0) return "–";
  const kmh = 3600 / sec;
  return kmh.toFixed(1);
}

export function BentoSplitsTable({
  routeData,
  heartRateData,
  isRunning = false,
  totalDistanceMeters,
  totalAscent,
  totalDescent,
}: Props) {
  const splits = computeSplits(
    routeData,
    heartRateData,
    totalDistanceMeters,
    totalAscent,
    totalDescent
  );
  if (splits.length === 0) return null;

  const paceLabel = isRunning ? "Tempo" : "Geschw.";
  const paceUnit = isRunning ? "min/km" : "km/h";

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] overflow-hidden">
      <div className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3] px-4 pt-4 pb-2`}>
        Splits · 1 km
      </div>
      <div className="overflow-x-auto">
        <table className={`w-full text-sm tabular-nums ${spaceMono.className}`}>
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3] border-t border-[#2a2a2a]">
              <th className="px-3 py-2 text-center w-10">#</th>
              <Th title="Dauer" sub="Runde / Gesamt" />
              <Th title="Distanz" sub="Runde / Gesamt" />
              <Th title="Herzfrequenz" sub="Ø / max." />
              <Th title={paceLabel} sub={`Ø / best · ${paceUnit}`} />
              <Th title="Hm" sub="↑ / ↓" />
            </tr>
          </thead>
          <tbody className="text-base">
            {splits.map((s) => (
              <tr
                key={s.index}
                className="border-t border-[#151515] hover:bg-[#151515] transition-colors align-middle"
              >
                <td className="px-3 py-2 text-center">
                  <SevenSegDisplay value={String(s.index)} />
                </td>
                <td className="px-3 py-2">
                  <SplitCell
                    primary={formatDuration(s.durationSec)}
                    secondary={formatDuration(s.cumDurationSec)}
                  />
                </td>
                <td className="px-3 py-2">
                  <SplitCell
                    primary={s.distanceKm.toFixed(2)}
                    secondary={s.cumDistanceKm.toFixed(2)}
                  />
                </td>
                <td className="px-3 py-2">
                  {s.hrAvg != null ? (
                    <SplitCell
                      primary={String(s.hrAvg)}
                      secondary={String(s.hrMax ?? "–")}
                    />
                  ) : (
                    <span className="text-[#a3a3a3]">–</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <SplitCell
                    primary={
                      isRunning
                        ? formatPace(s.paceSecPerKm)
                        : formatSpeed(s.paceSecPerKm)
                    }
                    secondary={
                      isRunning
                        ? formatPace(s.paceBestSecPerKm)
                        : formatSpeed(s.paceBestSecPerKm)
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <SplitCell
                    primary={String(s.ascent)}
                    secondary={String(s.descent)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SplitCell({
  primary,
  secondary,
}: {
  primary: string;
  secondary: string;
}) {
  return (
    <div className="flex items-center gap-1.5 leading-none">
      <SevenSegDisplay value={primary} />
      <span className="text-[#4a4a4a] text-sm">/</span>
      <SevenSegDisplay value={secondary} on="#a3a3a3" off="#1a1a1a" />
    </div>
  );
}

function Th({ title, sub }: { title: string; sub: string }) {
  return (
    <th className="px-3 py-2 font-bold">
      <div>{title}</div>
      <div className="font-normal text-[9px] tracking-[0.08em] text-[#4a4a4a] normal-case">
        {sub}
      </div>
    </th>
  );
}
