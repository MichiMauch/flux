import { computeSplits, type HrSample, type RoutePoint } from "@/lib/splits";

interface SplitsTableProps {
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

export function SplitsTable({
  routeData,
  heartRateData,
  isRunning = false,
  totalDistanceMeters,
  totalAscent,
  totalDescent,
}: SplitsTableProps) {
  const splits = computeSplits(
    routeData,
    heartRateData,
    totalDistanceMeters,
    totalAscent,
    totalDescent
  );
  if (splits.length === 0) return null;

  const paceLabel = isRunning ? "Tempo" : "Geschwindigkeit";
  const paceUnit = isRunning ? "min/km" : "km/h";

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground bg-surface">
              <th className="px-3 py-2 text-center w-10">#</th>
              <ThCol title="Dauer" sub="Runde / Gesamt" />
              <ThCol title="Distanz" sub="Runde / Gesamt" />
              <ThCol title="Herzfrequenz" sub="Ø / max." />
              <ThCol title={paceLabel} sub="Ø / best" />
              <ThCol title="Aufstieg / Abstieg" sub="m" />
            </tr>
          </thead>
          <tbody>
            {splits.map((s, i) => (
              <tr
                key={s.index}
                className={`border-t border-border transition-colors hover:bg-surface ${
                  i % 2 === 1 ? "bg-surface/40" : ""
                }`}
              >
                <td className="px-3 py-2 text-center text-muted-foreground">{s.index}</td>
                <td className="px-3 py-2">
                  <span className="font-semibold">{formatDuration(s.durationSec)}</span>
                  <span className="text-muted-foreground"> / {formatDuration(s.cumDurationSec)}</span>
                </td>
                <td className="px-3 py-2">
                  <span className="font-semibold">{s.distanceKm.toFixed(2)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    / {s.cumDistanceKm.toFixed(2)} km
                  </span>
                </td>
                <td className="px-3 py-2">
                  {s.hrAvg != null ? (
                    <>
                      <span className="font-semibold">{s.hrAvg}</span>
                      <span className="text-muted-foreground"> / {s.hrMax} bpm</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="font-semibold">
                    {isRunning ? formatPace(s.paceSecPerKm) : formatSpeed(s.paceSecPerKm)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    / {isRunning ? formatPace(s.paceBestSecPerKm) : formatSpeed(s.paceBestSecPerKm)}{" "}
                    {paceUnit}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="font-semibold">{s.ascent}</span>
                  <span className="text-muted-foreground"> / {s.descent} m</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThCol({ title, sub }: { title: string; sub: string }) {
  return (
    <th className="px-3 py-2 font-semibold">
      <div>{title}</div>
      <div className="font-normal text-[10px] normal-case tracking-normal text-muted-foreground">
        {sub}
      </div>
    </th>
  );
}
