import { Activity, Flame, Footprints, Ruler, Target, Clock, Moon } from "lucide-react";
import { formatDurationWordsSpaced, formatDistanceAuto } from "@/lib/activity-format";

interface DailyRow {
  date: string;
  steps: number | null;
  activeSteps: number | null;
  calories: number | null;
  activeCalories: number | null;
  durationSec: number | null;
  distance: number | null;
  activeTimeGoalSec: number | null;
  activeGoalCompletion: number | null;
  activeTimeZones: unknown;
  inactivityStamps: unknown;
  raw: unknown;
  createdAt: Date;
  updatedAt: Date;
}

function formatDuration(sec: number | null): string {
  return sec == null || sec <= 0 ? "–" : formatDurationWordsSpaced(sec);
}

function formatDistance(meters: number | null): string {
  return meters == null || meters <= 0 ? "–" : formatDistanceAuto(meters, 2);
}

function formatNumber(v: number | null): string {
  if (v == null) return "–";
  return v.toLocaleString("de-CH");
}

const ZONE_LABELS: Record<number, string> = {
  0: "Nicht getragen",
  1: "Sitzend",
  2: "Leicht",
  3: "Moderat",
  4: "Intensiv",
};

const ZONE_COLORS: Record<number, string> = {
  0: "#4a3e32",
  1: "#FFD9CC",
  2: "#FFB199",
  3: "#FF8466",
  4: "#C73A1E",
};

export function DailyActivityView({ data }: { data: DailyRow }) {
  const completionPct =
    data.activeGoalCompletion != null
      ? Math.round(
          (data.activeGoalCompletion > 1
            ? data.activeGoalCompletion
            : data.activeGoalCompletion * 100)
        )
      : null;

  const zones = parseZones(data.activeTimeZones);
  const totalZoneSec = zones.reduce((s, z) => s + z.seconds, 0);

  const inactivity = Array.isArray(data.inactivityStamps)
    ? (data.inactivityStamps as string[])
    : [];

  return (
    <div className="space-y-4">
      {/* Hero metrics */}
      <div className="rounded-lg border border-[#2a2a2a] bg-black/40 p-4 space-y-4">
        {completionPct != null && (
          <div>
            <div className="flex items-end justify-between mb-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3]">
                  Tagesziel
                </div>
                <div className="text-3xl font-bold tabular-nums tracking-[-0.03em] text-white">
                  {completionPct}%
                </div>
              </div>
              <div className="text-right text-[11px] text-[#9ca3af]">
                Aktivitätszeit / Ziel
                <div className="font-mono text-white mt-0.5">
                  {formatDuration(data.durationSec)} / {formatDuration(data.activeTimeGoalSec)}
                </div>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-black/60 overflow-hidden">
              <div
                className="h-full bg-[#FF6A00] transition-all"
                style={{ width: `${Math.min(100, completionPct)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#2a2a2a]">
          <Stat icon={<Footprints />} label="Schritte" value={formatNumber(data.steps)} />
          <Stat
            icon={<Ruler />}
            label="Distanz"
            value={formatDistance(data.distance)}
          />
          <Stat icon={<Flame />} label="Kalorien" value={formatNumber(data.calories)} unit="kcal" />
          <Stat
            icon={<Clock />}
            label="Aktivitätszeit"
            value={formatDuration(data.durationSec)}
          />
          <Stat
            icon={<Footprints />}
            label="Aktive Schritte"
            value={formatNumber(data.activeSteps)}
          />
          <Stat
            icon={<Flame />}
            label="Aktive Kalorien"
            value={formatNumber(data.activeCalories)}
            unit="kcal"
          />
          <Stat
            icon={<Target />}
            label="Ziel-Zeit"
            value={formatDuration(data.activeTimeGoalSec)}
          />
          <Stat
            icon={<Moon />}
            label="Inaktivität"
            value={inactivity.length > 0 ? String(inactivity.length) : "–"}
          />
        </div>
      </div>

      {/* Activity zones */}
      {zones.length > 0 && totalZoneSec > 0 && (
        <div className="rounded-lg border border-[#2a2a2a] bg-black/40 p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3] mb-3">
            <Activity className="h-3 w-3" /> Aktivitätszonen
          </div>
          <div className="flex h-3 rounded overflow-hidden bg-black/60">
            {zones.map((z) => (
              <div
                key={z.index}
                style={{
                  width: `${(z.seconds / totalZoneSec) * 100}%`,
                  background: ZONE_COLORS[z.index] ?? "#4a3e32",
                }}
                title={`${ZONE_LABELS[z.index] ?? `Zone ${z.index}`}: ${formatDuration(z.seconds)}`}
              />
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {zones.map((z) => (
              <div
                key={z.index}
                className="flex items-center gap-2 text-[11px] tabular-nums"
              >
                <span
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ background: ZONE_COLORS[z.index] ?? "#4a3e32" }}
                />
                <span className="font-semibold w-28 truncate text-white">
                  {ZONE_LABELS[z.index] ?? `Zone ${z.index}`}
                </span>
                <span className="ml-auto font-mono text-white">
                  {formatDuration(z.seconds)}
                </span>
                <span className="text-[#9ca3af] font-mono w-12 text-right">
                  {Math.round((z.seconds / totalZoneSec) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactivity stamps */}
      {inactivity.length > 0 && (
        <div className="rounded-lg border border-[#2a2a2a] bg-black/40 p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3] mb-3">
            <Moon className="h-3 w-3" /> Inaktivitätsstempel ({inactivity.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {inactivity.map((ts, i) => (
              <span
                key={i}
                className="inline-flex px-2 py-0.5 rounded-sm bg-black/60 border border-[#2a2a2a] text-[11px] font-mono tabular-nums text-white"
                title={ts}
              >
                {formatStamp(ts)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Raw JSON dump */}
      <details className="rounded-lg border border-[#2a2a2a] bg-black/40">
        <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3] hover:text-white">
          Raw Polar-Daten
        </summary>
        <pre className="px-4 pb-3 text-[11px] font-mono overflow-x-auto text-[#9ca3af] whitespace-pre-wrap">
          {JSON.stringify(data.raw, null, 2)}
        </pre>
      </details>

      <div className="text-[10px] text-[#9ca3af] font-mono text-center">
        Synced: {data.updatedAt.toLocaleString("de-CH")}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex-shrink-0 text-[#9ca3af] mt-0.5 [&>svg]:w-3.5 [&>svg]:h-3.5">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3] leading-tight">
          {label}
        </div>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-sm font-bold tabular-nums tracking-[-0.01em] text-white">
            {value}
          </span>
          {unit && (
            <span className="text-[10px] text-[#9ca3af]">{unit}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function parseZones(raw: unknown): { index: number; seconds: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((z: unknown) => {
      const obj = z as { index?: number; "inzone-duration"?: string };
      if (typeof obj.index !== "number") return null;
      const sec = parseIsoDur(obj["inzone-duration"]);
      return { index: obj.index, seconds: sec };
    })
    .filter((x): x is { index: number; seconds: number } => x !== null);
}

function parseIsoDur(s: string | undefined | null): number {
  if (!s) return 0;
  const m = s.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m) return 0;
  return Math.round(
    parseFloat(m[1] || "0") * 3600 +
      parseFloat(m[2] || "0") * 60 +
      parseFloat(m[3] || "0")
  );
}

function formatStamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}
