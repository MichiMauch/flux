import {
  Activity,
  HeartPulse,
  Moon,
  Sun,
  Thermometer,
  Watch,
  Wind,
  Zap,
} from "lucide-react";

interface ExtrasRow {
  date: string;
  cardioLoad: number | null;
  cardioLoadStatus: string | null;
  cardioLoadStrain: number | null;
  cardioLoadTolerance: number | null;
  cardioLoadRatio: number | null;
  cardioLoadLevel: unknown;
  cardioLoadRaw: unknown;
  continuousHrSamples: unknown;
  continuousHrRaw: unknown;
  alertnessRaw: unknown;
  circadianBedtimeRaw: unknown;
  bodyTemperatureRaw: unknown;
  skinTemperatureRaw: unknown;
  skinContactsRaw: unknown;
  wristEcgRaw: unknown;
  spo2Raw: unknown;
  updatedAt: Date;
}

function fmtNum(v: number | null, decimals = 1): string {
  if (v == null) return "–";
  return v.toFixed(decimals);
}

function fmtTimeOfDay(hms: string | null | undefined): string {
  if (!hms) return "–";
  // "HH:MM:SS" → "HH:MM"
  const m = hms.match(/^(\d{2}:\d{2})/);
  return m ? m[1] : hms;
}

export function DailyPolarExtrasView({ data }: { data: ExtrasRow }) {
  const hrSamples = parseHrSamples(data.continuousHrSamples);
  const hrStats = computeHrStats(hrSamples);

  const hasCardioLoad =
    data.cardioLoad != null ||
    data.cardioLoadStrain != null ||
    data.cardioLoadTolerance != null;
  const hasContinuousHr = hrSamples.length > 0;
  const alertness = parseAlertness(data.alertnessRaw);
  const circadian = parseCircadian(data.circadianBedtimeRaw);
  const bodyTempPeriods = parseBodyTemp(data.bodyTemperatureRaw);
  const skinTempNights = parseSkinTemp(data.skinTemperatureRaw);
  const skinContactPeriods = parseSkinContacts(data.skinContactsRaw);
  const ecgTests = parseEcgTests(data.wristEcgRaw);
  const spo2Tests = parseSpo2Tests(data.spo2Raw);

  return (
    <div className="space-y-4">
      {/* Cardio Load */}
      {hasCardioLoad && (
        <Section icon={<Zap className="h-3 w-3" />} title="Cardio Load (Polar Training Load Pro)">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <Stat label="Load (Tag)" value={fmtNum(data.cardioLoad)} />
            <Stat label="Strain" value={fmtNum(data.cardioLoadStrain)} />
            <Stat label="Toleranz" value={fmtNum(data.cardioLoadTolerance)} />
            <Stat label="Ratio" value={fmtNum(data.cardioLoadRatio, 2)} />
          </div>
          {data.cardioLoadStatus && (
            <div className="text-[11px] text-[#9ca3af]">
              Status:{" "}
              <span className="font-mono text-white">{data.cardioLoadStatus}</span>
            </div>
          )}
          {data.cardioLoadLevel ? (
            <CardioLoadLevels level={data.cardioLoadLevel} />
          ) : null}
          <RawDump value={data.cardioLoadRaw} />
        </Section>
      )}

      {/* Continuous Heart Rate */}
      {hasContinuousHr && (
        <Section
          icon={<HeartPulse className="h-3 w-3" />}
          title={`Herzfrequenz über den Tag (${hrSamples.length} Samples)`}
        >
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Stat label="Min" value={hrStats.min != null ? `${hrStats.min} bpm` : "–"} />
            <Stat label="Ø" value={hrStats.avg != null ? `${hrStats.avg} bpm` : "–"} />
            <Stat label="Max" value={hrStats.max != null ? `${hrStats.max} bpm` : "–"} />
          </div>
          <p className="text-[11px] text-[#9ca3af] mb-2 leading-snug">
            Polars kontinuierliche HR-Messung. Jeder Balken = ein Messpunkt
            (Hover für Uhrzeit + bpm).
          </p>
          <ContinuousHrChart samples={hrSamples} />
          <div className="mt-2 text-[10px] text-[#6b7280]">
            Erstes Sample {fmtTimeOfDay(hrSamples[0]?.time)} · Letztes{" "}
            {fmtTimeOfDay(hrSamples[hrSamples.length - 1]?.time)}
          </div>
          <RawDump value={data.continuousHrRaw} />
        </Section>
      )}

      {/* SleepWise Alertness */}
      {alertness.length > 0 && (
        <Section
          icon={<Sun className="h-3 w-3" />}
          title={`Tagesform-Vorhersage (${alertness.length} Einträge)`}
        >
          <p className="text-[11px] text-[#9ca3af] mb-3 leading-snug">
            Polars Sleep-Wise schätzt deine Wachheit/Tagesform. Höhere Note =
            wacher. Sleep-Inertia zeigt, wie lange das morgendliche Tief noch
            anhält.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {alertness.slice(0, 6).map((a, i) => (
              <div
                key={i}
                className="rounded p-2 bg-black/60 border border-[#2a2a2a]"
              >
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold tabular-nums text-white">
                    {a.grade != null ? a.grade.toFixed(1) : "–"}
                  </span>
                  <span className="text-[10px] text-[#9ca3af]">/10</span>
                </div>
                <div className="text-[10px] text-[#9ca3af] truncate">
                  {prettyEnum(a.gradeClassification)}
                </div>
                <div className="text-[10px] text-[#6b7280] mt-1">
                  {prettyEnum(a.sleepInertia)} · {prettyEnum(a.sleepType)}
                </div>
              </div>
            ))}
          </div>
          <RawDump value={data.alertnessRaw} />
        </Section>
      )}

      {/* Circadian Bedtime */}
      {circadian.length > 0 && (
        <Section
          icon={<Moon className="h-3 w-3" />}
          title={`Ideale Bettgehzeit (${circadian.length} Empfehlungen)`}
        >
          <p className="text-[11px] text-[#9ca3af] mb-3 leading-snug">
            Polar berechnet aus deinem Schlaf-/Aktivitätsmuster die biologisch
            optimale Bettgehzeit-Spanne.
          </p>
          <div className="space-y-1.5">
            {circadian.slice(0, 5).map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded p-2 bg-black/60 border border-[#2a2a2a]"
              >
                <Moon className="h-3.5 w-3.5 text-[#9ca3af] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold tabular-nums text-white font-mono">
                    {fmtRange(c.start, c.end)}
                  </div>
                  <div className="text-[10px] text-[#9ca3af] truncate">
                    {prettyEnum(c.quality)} · {prettyEnum(c.validity)} ·{" "}
                    {prettyEnum(c.resultType)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <RawDump value={data.circadianBedtimeRaw} />
        </Section>
      )}

      {/* Body Temperature */}
      {bodyTempPeriods.length > 0 && (
        <Section
          icon={<Thermometer className="h-3 w-3" />}
          title={`Körper-/Hauttemperatur (${bodyTempPeriods.length} Messperioden)`}
        >
          <div className="space-y-2">
            {bodyTempPeriods.map((p, i) => (
              <div
                key={i}
                className="rounded p-3 bg-black/60 border border-[#2a2a2a]"
              >
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-[#9ca3af]">
                      {prettyEnum(p.measurementType)} ·{" "}
                      {prettyEnum(p.sensorLocation)}
                    </div>
                    <div className="text-sm font-mono text-white tabular-nums">
                      {formatStampShort(p.startTime)} –{" "}
                      {formatStampShort(p.endTime)}
                    </div>
                  </div>
                  {p.minTemp != null && p.maxTemp != null && (
                    <div className="text-right">
                      <div className="text-lg font-bold tabular-nums text-white">
                        {p.minTemp.toFixed(1)}–{p.maxTemp.toFixed(1)}°C
                      </div>
                      <div className="text-[10px] text-[#9ca3af]">
                        ⌀ {p.avgTemp?.toFixed(2)}°C ({p.sampleCount} Samples)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <RawDump value={data.bodyTemperatureRaw} />
        </Section>
      )}

      {/* Skin Temperature (sleep) */}
      {skinTempNights.length > 0 && (
        <Section
          icon={<Thermometer className="h-3 w-3" />}
          title={`Schlaf-Hauttemperatur (${skinTempNights.length} Nächte)`}
        >
          <p className="text-[11px] text-[#9ca3af] mb-3 leading-snug">
            Polar misst während des Schlafs die Hauttemperatur. Abweichung von
            der Baseline kann auf Krankheit, Zyklus oder Übertraining hinweisen.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {skinTempNights.map((n, i) => (
              <div
                key={i}
                className="rounded p-2 bg-black/60 border border-[#2a2a2a]"
              >
                <div className="text-[10px] uppercase tracking-wider text-[#9ca3af]">
                  {n.sleepDate}
                </div>
                <div className="text-lg font-bold tabular-nums text-white">
                  {n.tempCelsius != null ? `${n.tempCelsius.toFixed(2)}°C` : "–"}
                </div>
                {n.deviation != null && Math.abs(n.deviation) < 100 && (
                  <div
                    className={`text-[10px] tabular-nums ${
                      n.deviation > 0 ? "text-[#FF8466]" : "text-[#9ca3af]"
                    }`}
                  >
                    {n.deviation >= 0 ? "+" : ""}
                    {n.deviation.toFixed(2)}°C Δ
                  </div>
                )}
              </div>
            ))}
          </div>
          <RawDump value={data.skinTemperatureRaw} />
        </Section>
      )}

      {/* Skin Contacts */}
      {skinContactPeriods.length > 0 && (
        <Section
          icon={<Watch className="h-3 w-3" />}
          title={`Hautkontakt (${skinContactPeriods.length} Perioden)`}
        >
          <p className="text-[11px] text-[#9ca3af] mb-3 leading-snug">
            Wann die Uhr Hautkontakt hatte (= getragen). Lücken = abgelegt.
          </p>
          <div className="space-y-1.5">
            {skinContactPeriods.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded p-2 bg-black/60 border border-[#2a2a2a] text-[11px] tabular-nums"
              >
                <Watch className="h-3 w-3 text-[#9ca3af] flex-shrink-0" />
                <span className="font-mono text-white">
                  {formatStampShort(p.startTime)} –{" "}
                  {formatStampShort(p.endTime)}
                </span>
                <span className="text-[#9ca3af] ml-auto">
                  {p.changes} Wechsel
                </span>
              </div>
            ))}
          </div>
          <RawDump value={data.skinContactsRaw} />
        </Section>
      )}

      {/* SpO2 Tests */}
      {spo2Tests.length > 0 && (
        <Section
          icon={<Wind className="h-3 w-3" />}
          title={`SpO₂ Tests (${spo2Tests.length})`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {spo2Tests.map((t, i) => (
              <div
                key={i}
                className="rounded p-3 bg-black/60 border border-[#2a2a2a]"
              >
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-2xl font-bold tabular-nums text-white">
                      {t.bloodOxygenPercent}%
                    </div>
                    <div className="text-[10px] text-[#9ca3af]">
                      Sauerstoffsättigung
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#9ca3af]">
                      {prettyEnum(t.testStatus)}
                    </div>
                    <div className="text-[10px] text-[#9ca3af] font-mono">
                      {formatEpoch(t.testTime, t.timeZoneOffset)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <RawDump value={data.spo2Raw} />
        </Section>
      )}

      {/* ECG Tests */}
      {ecgTests.length > 0 && (
        <Section
          icon={<Activity className="h-3 w-3" />}
          title={`Wrist-EKG Tests (${ecgTests.length})`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ecgTests.map((t, i) => (
              <div
                key={i}
                className="rounded p-3 bg-black/60 border border-[#2a2a2a]"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] uppercase text-[#9ca3af]">Avg HR</div>
                    <div className="text-lg font-bold tabular-nums text-white">
                      {t.avgHr ?? "–"}
                      <span className="text-[10px] text-[#9ca3af] ml-1">bpm</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-[#9ca3af]">HRV</div>
                    <div className="text-lg font-bold tabular-nums text-white">
                      {t.hrvMs != null ? `${t.hrvMs.toFixed(1)}ms` : "–"}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-[#9ca3af] mt-2">
                  {prettyEnum(t.hrvLevel)} ·{" "}
                  {formatEpoch(t.testTime, t.timeZoneOffset)}
                </div>
              </div>
            ))}
          </div>
          <RawDump value={data.wristEcgRaw} />
        </Section>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface AlertnessEntry {
  grade: number | null;
  gradeClassification: string | null;
  sleepInertia: string | null;
  sleepType: string | null;
}

function parseAlertness(raw: unknown): AlertnessEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e) => {
    const o = e as Record<string, unknown>;
    return {
      grade: typeof o.grade === "number" ? o.grade : null,
      gradeClassification:
        typeof o.grade_classification === "string"
          ? (o.grade_classification as string)
          : null,
      sleepInertia:
        typeof o.sleep_inertia === "string"
          ? (o.sleep_inertia as string)
          : null,
      sleepType:
        typeof o.sleep_type === "string" ? (o.sleep_type as string) : null,
    };
  });
}

interface CircadianEntry {
  start: string | null;
  end: string | null;
  quality: string | null;
  validity: string | null;
  resultType: string | null;
}

function parseCircadian(raw: unknown): CircadianEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e) => {
    const o = e as Record<string, unknown>;
    return {
      start:
        typeof o.period_start_time === "string"
          ? (o.period_start_time as string)
          : null,
      end:
        typeof o.period_end_time === "string"
          ? (o.period_end_time as string)
          : null,
      quality: typeof o.quality === "string" ? (o.quality as string) : null,
      validity:
        typeof o.validity === "string" ? (o.validity as string) : null,
      resultType:
        typeof o.result_type === "string" ? (o.result_type as string) : null,
    };
  });
}

function prettyEnum(s: string | null | undefined): string {
  if (!s) return "–";
  // "GRADE_CLASSIFICATION_WEAK" → "Weak"
  // "SLEEP_INERTIA_MODERATE" → "Moderate"
  const parts = s.split("_");
  if (parts.length <= 1) return s;
  // drop the leading prefix words (everything before the last meaningful word)
  const last = parts[parts.length - 1];
  return last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
}

function fmtRange(start: string | null, end: string | null): string {
  if (!start || !end) return "–";
  const s = formatStampShort(start);
  const e = formatStampShort(end);
  return `${s} – ${e}`;
}

function formatStampShort(ts: string | null | undefined): string {
  if (!ts) return "–";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface BodyTempPeriod {
  measurementType: string | null;
  sensorLocation: string | null;
  startTime: string | null;
  endTime: string | null;
  minTemp: number | null;
  maxTemp: number | null;
  avgTemp: number | null;
  sampleCount: number;
}

function parseBodyTemp(raw: unknown): BodyTempPeriod[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const o = p as Record<string, unknown>;
    const samples = Array.isArray(o.samples)
      ? (o.samples as Array<{ temperature_celsius?: number }>)
      : [];
    const temps = samples
      .map((s) => s.temperature_celsius)
      .filter((t): t is number => typeof t === "number");
    return {
      measurementType:
        typeof o.measurement_type === "string"
          ? (o.measurement_type as string)
          : null,
      sensorLocation:
        typeof o.sensor_location === "string"
          ? (o.sensor_location as string)
          : null,
      startTime: typeof o.start_time === "string" ? (o.start_time as string) : null,
      endTime: typeof o.end_time === "string" ? (o.end_time as string) : null,
      minTemp: temps.length ? Math.min(...temps) : null,
      maxTemp: temps.length ? Math.max(...temps) : null,
      avgTemp: temps.length
        ? temps.reduce((s, t) => s + t, 0) / temps.length
        : null,
      sampleCount: samples.length,
    };
  });
}

interface SkinTempNight {
  sleepDate: string | null;
  tempCelsius: number | null;
  deviation: number | null;
}

function parseSkinTemp(raw: unknown): SkinTempNight[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const o = p as Record<string, unknown>;
    return {
      sleepDate: typeof o.sleep_date === "string" ? (o.sleep_date as string) : null,
      tempCelsius:
        typeof o.sleep_time_skin_temperature_celsius === "number"
          ? (o.sleep_time_skin_temperature_celsius as number)
          : null,
      deviation:
        typeof o.deviation_from_baseline_celsius === "number"
          ? (o.deviation_from_baseline_celsius as number)
          : null,
    };
  });
}

interface SkinContactPeriod {
  startTime: string | null;
  endTime: string | null;
  changes: number;
}

function parseSkinContacts(raw: unknown): SkinContactPeriod[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const o = p as Record<string, unknown>;
    const changes = Array.isArray(o.skin_contact_changes)
      ? (o.skin_contact_changes as unknown[]).length
      : 0;
    return {
      startTime: typeof o.start_time === "string" ? (o.start_time as string) : null,
      endTime: typeof o.end_time === "string" ? (o.end_time as string) : null,
      changes,
    };
  });
}

interface EcgTest {
  testTime: number | null;
  timeZoneOffset: number | null;
  avgHr: number | null;
  hrvMs: number | null;
  hrvLevel: string | null;
}

function parseEcgTests(raw: unknown): EcgTest[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => {
    const o = t as Record<string, unknown>;
    return {
      testTime:
        typeof o.test_time === "number" ? (o.test_time as number) : null,
      timeZoneOffset:
        typeof o.time_zone_offset === "number"
          ? (o.time_zone_offset as number)
          : null,
      avgHr:
        typeof o.average_heart_rate_bpm === "number"
          ? (o.average_heart_rate_bpm as number)
          : null,
      hrvMs:
        typeof o.heart_rate_variability_ms === "number"
          ? (o.heart_rate_variability_ms as number)
          : null,
      hrvLevel:
        typeof o.heart_rate_variability_level === "string"
          ? (o.heart_rate_variability_level as string)
          : null,
    };
  });
}

interface Spo2Test {
  testTime: number | null;
  timeZoneOffset: number | null;
  testStatus: string | null;
  bloodOxygenPercent: number | null;
}

function parseSpo2Tests(raw: unknown): Spo2Test[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => {
    const o = t as Record<string, unknown>;
    return {
      testTime:
        typeof o.test_time === "number" ? (o.test_time as number) : null,
      timeZoneOffset:
        typeof o.time_zone_offset === "number"
          ? (o.time_zone_offset as number)
          : null,
      testStatus:
        typeof o.test_status === "string" ? (o.test_status as string) : null,
      bloodOxygenPercent:
        typeof o.blood_oxygen_percent === "number"
          ? (o.blood_oxygen_percent as number)
          : null,
    };
  });
}

function formatEpoch(epochSec: number | null, tzOffset: number | null): string {
  if (epochSec == null) return "–";
  const d = new Date((epochSec + (tzOffset ?? 0) * 60) * 1000);
  return d.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseHrSamples(
  raw: unknown,
): { time: string; bpm: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      const o = s as { heart_rate?: number; sample_time?: string };
      if (typeof o.heart_rate !== "number" || typeof o.sample_time !== "string") {
        return null;
      }
      return { time: o.sample_time, bpm: o.heart_rate };
    })
    .filter((x): x is { time: string; bpm: number } => x !== null);
}

function computeHrStats(samples: { bpm: number }[]): {
  min: number | null;
  max: number | null;
  avg: number | null;
} {
  if (samples.length === 0) return { min: null, max: null, avg: null };
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const s of samples) {
    if (s.bpm < min) min = s.bpm;
    if (s.bpm > max) max = s.bpm;
    sum += s.bpm;
  }
  return { min, max, avg: Math.round(sum / samples.length) };
}

function timeToFraction(time: string): number {
  // "HH:MM:SS" → 0–1 over 24h
  const m = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sec =
    Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? "0");
  return sec / 86400;
}

function ContinuousHrChart({
  samples,
}: {
  samples: { time: string; bpm: number }[];
}) {
  const max = Math.max(...samples.map((s) => s.bpm), 1);
  const min = Math.min(...samples.map((s) => s.bpm), max);
  const range = Math.max(1, max - min);
  return (
    <div>
      <div className="relative h-20 bg-black/30 rounded">
        {samples.map((s, i) => {
          const left = timeToFraction(s.time) * 100;
          const h = ((s.bpm - min) / range) * 90 + 8;
          return (
            <div
              key={i}
              className="absolute bottom-0 bg-[#FF6A00]/70 hover:bg-[#FF6A00] transition-colors"
              style={{
                left: `${left}%`,
                width: "1.5px",
                height: `${h}%`,
              }}
              title={`${s.time}: ${s.bpm} bpm`}
            />
          );
        })}
      </div>
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
    </div>
  );
}

function CardioLoadLevels({ level }: { level: unknown }) {
  if (!level || typeof level !== "object") return null;
  const o = level as Record<string, unknown>;
  const entries = [
    { key: "very_low", label: "Sehr niedrig", color: "#4a3e32" },
    { key: "low", label: "Niedrig", color: "#FFD9CC" },
    { key: "medium", label: "Mittel", color: "#FFB199" },
    { key: "high", label: "Hoch", color: "#FF8466" },
    { key: "very_high", label: "Sehr hoch", color: "#C73A1E" },
  ].map((e) => ({
    ...e,
    value: typeof o[e.key] === "number" ? (o[e.key] as number) : null,
  }));
  return (
    <div className="grid grid-cols-5 gap-1.5 mt-3">
      {entries.map((e) => (
        <div
          key={e.key}
          className="rounded p-2 bg-black/60 border border-[#2a2a2a] text-center"
        >
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-sm" style={{ background: e.color }} />
            <span className="text-[9px] uppercase tracking-wider text-[#9ca3af]">
              {e.label}
            </span>
          </div>
          <div className="text-sm font-bold tabular-nums text-white">
            {e.value != null ? e.value.toFixed(1) : "–"}
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-black/40 p-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3] mb-3">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3] leading-tight">
        {label}
      </div>
      <div className="text-sm font-bold tabular-nums tracking-[-0.01em] text-white mt-0.5">
        {value}
      </div>
    </div>
  );
}

function RawDump({
  value,
  expanded = false,
}: {
  value: unknown;
  expanded?: boolean;
}) {
  if (value == null) return null;
  return (
    <details className="mt-3" open={expanded}>
      <summary className="cursor-pointer select-none text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280] hover:text-white">
        Raw JSON
      </summary>
      <pre className="mt-2 text-[11px] font-mono overflow-x-auto text-[#9ca3af] whitespace-pre-wrap bg-black/60 rounded p-2">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
