import { Activity, Flame, Footprints, Ruler, Target, Clock, Moon, AlarmClock } from "lucide-react";
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
  inactivityAlertCount: number | null;
  inactiveDurationSec: number | null;
  raw: unknown;
  rawV3: unknown;
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
  return v == null ? "–" : v.toLocaleString("de-CH");
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

  const inactivity = parseInactivityStamps(data.inactivityStamps);
  // Polar v3 gibt inactivity_alert_count separat. Wenn vorhanden, bevorzugen
  // wir den; sonst Stamps-Länge als Proxy.
  const inactivityCount =
    data.inactivityAlertCount ?? (inactivity.length > 0 ? inactivity.length : null);

  const stepSamples = parseStepSamples(data.rawV3);
  const zoneSamples = parseZoneSamples(data.rawV3);
  const v3StartEnd = parseV3StartEnd(data.rawV3);

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

        <div
          className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${
            completionPct != null ? "pt-2 border-t border-[#2a2a2a]" : ""
          }`}
        >
          <Stat
            icon={<Footprints />}
            label="Aktive Schritte"
            value={formatNumber(data.activeSteps)}
          />
          <Stat
            icon={<Flame />}
            label="Kalorien"
            value={formatNumber(data.calories)}
            unit="kcal"
          />
          <Stat
            icon={<Clock />}
            label="Aktivitätszeit"
            value={formatDuration(data.durationSec)}
          />
          <Stat
            icon={<Flame />}
            label="Aktive Kalorien"
            value={formatNumber(data.activeCalories)}
            unit="kcal"
          />
          <Stat
            icon={<AlarmClock />}
            label="Inaktivitäts-Alarme"
            value={formatNumber(inactivityCount)}
          />
          <Stat
            icon={<Moon />}
            label="Inaktive Zeit"
            value={formatDuration(data.inactiveDurationSec)}
          />
          {data.distance != null && data.distance > 0 && (
            <Stat
              icon={<Ruler />}
              label="Distanz"
              value={formatDistance(data.distance)}
            />
          )}
          {data.activeTimeGoalSec != null && data.activeTimeGoalSec > 0 && (
            <Stat
              icon={<Target />}
              label="Ziel-Zeit"
              value={formatDuration(data.activeTimeGoalSec)}
            />
          )}
        </div>

        {v3StartEnd && (
          <div className="text-[11px] text-[#9ca3af] tabular-nums font-mono pt-2 border-t border-[#2a2a2a]">
            Tag-Start {v3StartEnd.start ?? "–"} · Tag-Ende {v3StartEnd.end ?? "–"}
          </div>
        )}
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

      {/* Inactivity alerts (with timestamps) */}
      {(inactivity.length > 0 ||
        (inactivityCount != null && inactivityCount > 0)) && (
        <div className="rounded-lg border border-[#2a2a2a] bg-black/40 p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3]">
              <AlarmClock className="h-3 w-3" /> Inaktivitäts-Alarme (
              {inactivityCount ?? inactivity.length})
            </div>
          </div>
          <p className="text-[11px] text-[#9ca3af] mb-3 leading-snug">
            Polar löst einen Alarm aus, wenn du zu lange still warst — die Uhrzeit
            ist der Moment, an dem die Uhr dich aufgefordert hat, dich zu bewegen.
          </p>
          {inactivity.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {inactivity
                .slice()
                .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                .map((ts, i) => {
                  const d = new Date(ts);
                  const valid = !isNaN(d.getTime());
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center px-2.5 py-1.5 rounded-md bg-black/60 border border-[#2a2a2a]"
                      title={ts}
                    >
                      <span className="text-sm font-bold tabular-nums text-white font-mono">
                        {valid
                          ? d.toLocaleTimeString("de-CH", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ts}
                      </span>
                      <span className="text-[9px] text-[#9ca3af] tabular-nums">
                        {valid
                          ? d.toLocaleDateString("de-CH", {
                              day: "2-digit",
                              month: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-[11px] text-[#9ca3af] italic">
              Polar hat {inactivityCount} Alarm{inactivityCount === 1 ? "" : "e"}{" "}
              gemeldet, aber keine Zeitstempel zurückgegeben.
            </p>
          )}
        </div>
      )}

      {/* Step samples (v3) */}
      {stepSamples.length > 0 && (
        <div className="rounded-lg border border-[#2a2a2a] bg-black/40 p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3]">
              <Footprints className="h-3 w-3" /> Schritte über den Tag
            </div>
            <div className="text-[10px] text-[#9ca3af] tabular-nums">
              {stepSamples.length} Messpunkte · max{" "}
              {formatNumber(Math.max(...stepSamples.map((s) => s.steps), 0))}/Intervall
            </div>
          </div>
          <p className="text-[11px] text-[#9ca3af] mb-3 leading-snug">
            Polar misst die Schritte in regelmässigen Intervallen. Jeder Balken zeigt die
            Schritte in einem Zeitfenster (Hover für Uhrzeit + Wert).
          </p>
          <StepSamplesChart samples={stepSamples} />
        </div>
      )}

      {/* Zone samples timeline (v3) */}
      {zoneSamples.length > 0 && (
        <div className="rounded-lg border border-[#2a2a2a] bg-black/40 p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3]">
              <Activity className="h-3 w-3" /> Aktivitätszonen über den Tag
            </div>
            <div className="text-[10px] text-[#9ca3af] tabular-nums">
              {zoneSamples.length} Übergänge
            </div>
          </div>
          <p className="text-[11px] text-[#9ca3af] mb-3 leading-snug">
            Polar protokolliert jeden Zonenwechsel mit Zeitstempel. Die Farbe zeigt die
            Intensität pro Zeitfenster (0 – 24 Uhr, links nach rechts).
          </p>
          <ZoneSamplesTimeline samples={zoneSamples} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className="w-2 h-2 rounded-sm"
                  style={{ background: ZONE_COLORS[idx] }}
                />
                <span className="text-[#9ca3af]">{ZONE_LABELS[idx]}</span>
              </div>
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
          {JSON.stringify(
            data.rawV3 ? { transaction: data.raw, v3: data.rawV3 } : data.raw,
            null,
            2,
          )}
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

function parseStepSamples(rawV3: unknown): { ts: string; steps: number }[] {
  const v3 = rawV3 as { samples?: { steps?: { samples?: unknown[] } } } | null;
  const arr = v3?.samples?.steps?.samples;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => {
      const obj = s as { steps?: number; timestamp?: string };
      if (typeof obj.steps !== "number" || typeof obj.timestamp !== "string") {
        return null;
      }
      return { ts: obj.timestamp, steps: obj.steps };
    })
    .filter((x): x is { ts: string; steps: number } => x !== null);
}

function parseZoneSamples(
  rawV3: unknown,
): { ts: string; zone: string }[] {
  const v3 = rawV3 as { samples?: { activity_zones?: { samples?: unknown[] } } } | null;
  const arr = v3?.samples?.activity_zones?.samples;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => {
      const obj = s as { zone?: string; timestamp?: string };
      if (typeof obj.zone !== "string" || typeof obj.timestamp !== "string") {
        return null;
      }
      return { ts: obj.timestamp, zone: obj.zone };
    })
    .filter((x): x is { ts: string; zone: string } => x !== null);
}

function parseV3StartEnd(rawV3: unknown): { start: string | null; end: string | null } | null {
  const v3 = rawV3 as { start_time?: string; end_time?: string } | null;
  if (!v3 || (!v3.start_time && !v3.end_time)) return null;
  return {
    start: v3.start_time ? formatStamp(v3.start_time) : null,
    end: v3.end_time ? formatStamp(v3.end_time) : null,
  };
}

// Polar v3 zone names → Index aus dem Transaction-Schema mappen, damit wir die
// gleichen Farben benutzen.
const V3_ZONE_INDEX: Record<string, number> = {
  NON_WEAR: 0,
  SEDENTARY: 1,
  LIGHT: 2,
  CONTINUOUS_MODERATE: 3,
  INTERMITTENT_MODERATE: 3,
  CONTINUOS_VIGOROUS: 4,
  CONTINUOUS_VIGOROUS: 4,
  INTERMITTENT_VIGOROUS: 4,
};

// Tageszeit eines ISO-Stamps als 0–1 (Anteil am 24-h-Tag, lokale Zeit).
function dayFraction(ts: string): number {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return 0;
  const sec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  return sec / 86400;
}

function HourAxis() {
  return (
    <div className="relative h-4 mt-1 text-[9px] text-[#6b7280] font-mono tabular-nums">
      {[0, 6, 12, 18, 24].map((h) => (
        <span
          key={h}
          className="absolute -translate-x-1/2"
          style={{ left: `${(h / 24) * 100}%` }}
        >
          {String(h).padStart(2, "0")}
        </span>
      ))}
    </div>
  );
}

function StepSamplesChart({ samples }: { samples: { ts: string; steps: number }[] }) {
  const max = Math.max(...samples.map((s) => s.steps), 1);
  return (
    <div>
      <div className="relative h-16 bg-black/30 rounded">
        {samples.map((s, i) => {
          const left = dayFraction(s.ts) * 100;
          const h = Math.max(2, (s.steps / max) * 100);
          return (
            <div
              key={i}
              className="absolute bottom-0 bg-[#FF6A00]/70 hover:bg-[#FF6A00] transition-colors"
              style={{
                left: `${left}%`,
                width: "2px",
                height: `${h}%`,
              }}
              title={`${formatStamp(s.ts)}: ${s.steps} Schritte`}
            />
          );
        })}
      </div>
      <HourAxis />
    </div>
  );
}

function ZoneSamplesTimeline({
  samples,
}: {
  samples: { ts: string; zone: string }[];
}) {
  // Zonen-Wechsel: Segment vom vorherigen Stamp bis zum nächsten (oder Tagesende)
  // einfärben. Ergibt eine echte Zeitachse statt gleichbreiter Slots.
  const sorted = [...samples].sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
  );
  return (
    <div>
      <div className="relative h-4 bg-black/60 rounded overflow-hidden">
        {sorted.map((s, i) => {
          const idx = V3_ZONE_INDEX[s.zone] ?? 0;
          const left = dayFraction(s.ts) * 100;
          const nextLeft =
            i + 1 < sorted.length ? dayFraction(sorted[i + 1].ts) * 100 : 100;
          const width = Math.max(0.1, nextLeft - left);
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: ZONE_COLORS[idx] ?? "#4a3e32",
              }}
              title={`${formatStamp(s.ts)}: ${ZONE_LABELS[idx] ?? s.zone}`}
            />
          );
        })}
      </div>
      <HourAxis />
    </div>
  );
}

// Polar liefert Inactivity-Stamps in drei Shapes:
//  - legacy Transaction-Endpoint: string[] (ISO-Timestamps)
//  - Doku v3: {stamp: string}[]
//  - tatsächlich v3: { samples: {stamp: string}[] }   ← Doku ist falsch
function parseInactivityStamps(raw: unknown): string[] {
  // Wrapper {samples: [...]} auspacken
  let arr: unknown = raw;
  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    "samples" in raw
  ) {
    arr = (raw as { samples?: unknown }).samples;
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => {
      if (typeof s === "string") return s;
      if (s && typeof s === "object" && "stamp" in s) {
        const stamp = (s as { stamp?: unknown }).stamp;
        return typeof stamp === "string" ? stamp : null;
      }
      return null;
    })
    .filter((x): x is string => x !== null);
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
