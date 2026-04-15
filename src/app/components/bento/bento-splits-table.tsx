import { computeSplits, type HrSample, type RoutePoint } from "@/lib/splits";

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
    <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] overflow-hidden">
      <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6b6b] px-4 pt-4 pb-2">
        Splits · 1 km
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums [font-family:var(--bento-mono)]">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b6b6b] border-t border-[#1f1f1f]">
              <th className="px-3 py-2 text-center w-10">#</th>
              <Th title="Dauer" sub="Runde / Gesamt" />
              <Th title="Distanz" sub="Runde / Gesamt" />
              <Th title="Herzfrequenz" sub="Ø / max." />
              <Th title={paceLabel} sub={`Ø / best · ${paceUnit}`} />
              <Th title="Hm" sub="↑ / ↓" />
            </tr>
          </thead>
          <tbody>
            {splits.map((s) => (
              <tr
                key={s.index}
                className="border-t border-[#151515] hover:bg-[#151515] transition-colors"
              >
                <td className="px-3 py-2 text-center text-[#6b6b6b] font-bold">
                  {s.index}
                </td>
                <td className="px-3 py-2">
                  <span className="font-bold text-white">{formatDuration(s.durationSec)}</span>
                  <span className="text-[#6b6b6b]"> / {formatDuration(s.cumDurationSec)}</span>
                </td>
                <td className="px-3 py-2">
                  <span className="font-bold text-white">{s.distanceKm.toFixed(2)}</span>
                  <span className="text-[#6b6b6b]"> / {s.cumDistanceKm.toFixed(2)}</span>
                </td>
                <td className="px-3 py-2">
                  {s.hrAvg != null ? (
                    <>
                      <span className="font-bold text-white">{s.hrAvg}</span>
                      <span className="text-[#6b6b6b]"> / {s.hrMax}</span>
                    </>
                  ) : (
                    <span className="text-[#6b6b6b]">–</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="font-bold text-white">
                    {isRunning ? formatPace(s.paceSecPerKm) : formatSpeed(s.paceSecPerKm)}
                  </span>
                  <span className="text-[#6b6b6b]">
                    {" "}
                    /{" "}
                    {isRunning
                      ? formatPace(s.paceBestSecPerKm)
                      : formatSpeed(s.paceBestSecPerKm)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="font-bold text-white">{s.ascent}</span>
                  <span className="text-[#6b6b6b]"> / {s.descent}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
