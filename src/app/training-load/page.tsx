import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  Battery,
  Sparkles,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { BentoTile } from "../components/bento/bento-tile";
import { rajdhani, spaceMono } from "../components/bento/bento-fonts";
import { TrainingLoadChart } from "../components/training-load-chart";
import { getDailyTrimp } from "@/lib/training-load-query";
import {
  computeReadiness,
  computeTrainingLoadSeries,
  interpretReadiness,
} from "@/lib/training-load";

const NEON = "#FF6A00";

const RANGES = [
  { key: "90", label: "90 Tage", days: 90 },
  { key: "180", label: "180 Tage", days: 180 },
  { key: "365", label: "1 Jahr", days: 365 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

function parseRange(raw: string | string[] | undefined): RangeKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return RANGES.some((r) => r.key === v) ? (v as RangeKey) : "180";
}

interface PageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function TrainingLoadPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const rangeKey = parseRange(params.range);
  const range = RANGES.find((r) => r.key === rangeKey)!;

  const now = new Date();
  const visibleEnd = new Date(now);
  visibleEnd.setHours(23, 59, 59, 999);
  const visibleStart = new Date(visibleEnd);
  visibleStart.setDate(visibleStart.getDate() - (range.days - 1));
  visibleStart.setHours(0, 0, 0, 0);
  const computeStart = new Date(visibleStart);
  computeStart.setDate(computeStart.getDate() - 42);

  const daily = await getDailyTrimp(session.user.id, computeStart, visibleEnd);
  const fullSeries = computeTrainingLoadSeries(
    daily,
    computeStart,
    visibleEnd
  );
  const series = fullSeries.slice(42);

  const latest = series[series.length - 1];
  const weekAgo = series[series.length - 8] ?? series[0];
  const hasData = daily.size > 0 && latest != null;

  const readiness = latest ? computeReadiness(latest.tsb) : 50;
  const readinessPrev = weekAgo ? computeReadiness(weekAgo.tsb) : readiness;
  const readinessDelta = readiness - readinessPrev;
  const interp = latest
    ? interpretReadiness(latest.tsb)
    : interpretReadiness(0);

  const ctlDelta = latest ? latest.ctl - weekAgo.ctl : 0;
  const atlDelta = latest ? latest.atl - weekAgo.atl : 0;

  return (
    <BentoPageShell>
      <BentoPageHeader
        section="Training Load"
        title="Form"
        titleScale="compact"
      />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:auto-rows-min md:[grid-auto-flow:row_dense]">
        {/* Bereitschaft hero — 0-100 score */}
        <div className="md:col-span-4">
          <ReadinessHero
            readiness={readiness}
            delta={hasData ? readinessDelta : null}
            interp={interp}
          />
        </div>

        {/* Range switcher */}
        <div className="md:col-span-2 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 flex flex-col justify-between">
          <div>
            <div
              className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3] mb-2`}
            >
              Zeitraum
            </div>
            <RangeSwitcher active={rangeKey} />
          </div>
          <div
            className={`${spaceMono.className} text-[10px] text-[#737373] mt-4 leading-relaxed`}
          >
            TRIMP-Daten werden aus allen Aktivitäten mit Herzfrequenz
            berechnet.
          </div>
        </div>

        {/* KPI row: Fitness · Ermüdung · Frische */}
        <KpiCard
          label="Fitness"
          sub="Langfristiger Trend · 42d"
          value={latest ? latest.ctl.toFixed(1) : "–"}
          delta={hasData ? ctlDelta : null}
          accent="#60A5FA"
          icon={<Activity className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Ermüdung"
          sub="Kurzfristig · 7d"
          value={latest ? latest.atl.toFixed(1) : "–"}
          delta={hasData ? atlDelta : null}
          accent="#F472B6"
          icon={<Battery className="h-3.5 w-3.5" />}
          invertDelta
        />
        <KpiCard
          label="Bilanz"
          sub="Fitness − Ermüdung"
          value={latest ? formatSigned(latest.tsb) : "–"}
          delta={hasData ? latest!.tsb - weekAgo.tsb : null}
          accent="#EAB308"
          icon={<Sparkles className="h-3.5 w-3.5" />}
        />

        {/* Erklärblock — "So liest du das" */}
        <div className="md:col-span-6">
          <BentoTile label="So liest du das" title={null}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Explainer
                dotColor="#60A5FA"
                title="Fitness"
                body="Wie viel du insgesamt trainierst. Steigt langsam (braucht Wochen), fällt auch langsam. Je höher, desto belastbarer bist du."
              />
              <Explainer
                dotColor="#F472B6"
                title="Ermüdung"
                body="Wie fertig du gerade bist. Steigt nach harten Tagen schnell an und baut sich in ein paar Tagen Ruhe wieder ab. Ist nicht negativ — sie zeigt nur, wie viel Last drin steckt."
              />
              <Explainer
                dotColor="#EAB308"
                title="Bilanz"
                body="Fitness minus Ermüdung. Positiv = ausgeruht (gut vor Wettkämpfen). Negativ = belastet (normal im Trainingsblock). Die Bereitschaft oben fasst das zu einer Zahl zusammen."
              />
            </div>
          </BentoTile>
        </div>

        {/* Chart */}
        <div className="md:col-span-6">
          <BentoTile
            label="Verlauf"
            title="Fitness & Ermüdung"
          >
            {hasData ? (
              <div style={{ height: 360 }}>
                <TrainingLoadChart data={series} />
              </div>
            ) : (
              <EmptyState />
            )}
            <p
              className={`${spaceMono.className} text-[10px] text-[#737373] mt-3 leading-relaxed`}
            >
              Orange Balken = tägliche Trainingsbelastung (TRIMP). Die{" "}
              <span style={{ color: "#60A5FA" }}>blaue Linie</span> ist deine
              Fitness, die <span style={{ color: "#F472B6" }}>rosa Linie</span>{" "}
              deine Ermüdung. Der{" "}
              <span style={{ color: "#22C55E" }}>grüne Bereich</span> zwischen
              ihnen bedeutet frisch, der{" "}
              <span style={{ color: "#F97316" }}>orange Bereich</span> belastet.
            </p>
          </BentoTile>
        </div>
      </div>
    </BentoPageShell>
  );
}

function ReadinessHero({
  readiness,
  delta,
  interp,
}: {
  readiness: number;
  delta: number | null;
  interp: ReturnType<typeof interpretReadiness>;
}) {
  const arrow =
    delta == null || Math.abs(delta) < 1 ? null : delta > 0 ? "up" : "down";
  const deltaColor =
    arrow === "up" ? "#22C55E" : arrow === "down" ? "#EF4444" : "#737373";

  return (
    <div
      className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-5 h-full flex flex-col"
      style={{
        background: `radial-gradient(ellipse at top left, ${interp.color}12, #0f0f0f 70%)`,
        borderColor: `${interp.color}55`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles className="h-3.5 w-3.5" style={{ color: interp.color }} />
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          Bereitschaft heute
        </span>
      </div>

      <div className="flex items-baseline gap-4 mb-3">
        <span
          className={`${rajdhani.className} font-bold tabular-nums leading-none`}
          style={{
            fontSize: "clamp(64px, 9vw, 120px)",
            color: interp.color,
            textShadow: `0 0 24px ${interp.color}66, 0 0 48px ${interp.color}33`,
          }}
        >
          {readiness}
        </span>
        <div className="flex flex-col gap-1">
          <span
            className={`${rajdhani.className} text-3xl font-bold uppercase leading-none`}
            style={{ color: interp.color }}
          >
            {interp.headline}
          </span>
          {delta != null && arrow && (
            <span
              className={`${spaceMono.className} inline-flex items-center gap-1 text-[11px] font-bold tabular-nums`}
              style={{ color: deltaColor }}
            >
              {arrow === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {formatSigned(delta)} vs. vor 7 Tagen
            </span>
          )}
        </div>
      </div>

      {/* Readiness bar */}
      <div className="mb-3">
        <div className="relative h-2 rounded-full overflow-hidden bg-[#1a1a1a]">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${readiness}%`,
              background: `linear-gradient(90deg, ${interp.color}99, ${interp.color})`,
              boxShadow: `0 0 8px ${interp.color}aa`,
            }}
          />
        </div>
        <div
          className={`${spaceMono.className} flex justify-between text-[9px] text-[#737373] mt-1 tabular-nums uppercase tracking-[0.12em]`}
        >
          <span>0 · ausgelaugt</span>
          <span>50</span>
          <span>100 · frisch</span>
        </div>
      </div>

      <p
        className={`${spaceMono.className} text-[11px] text-[#d4d4d4] leading-relaxed mt-auto`}
      >
        {interp.hint}
      </p>
    </div>
  );
}

function KpiCard({
  label,
  sub,
  value,
  delta,
  accent,
  icon,
  invertDelta = false,
}: {
  label: string;
  sub: string;
  value: string;
  delta: number | null;
  accent: string;
  icon: React.ReactNode;
  invertDelta?: boolean;
}) {
  const direction =
    delta == null || Math.abs(delta) < 0.1
      ? "flat"
      : (invertDelta ? delta < 0 : delta > 0)
        ? "good"
        : "bad";
  const deltaColor =
    direction === "good"
      ? "#22C55E"
      : direction === "bad"
        ? "#EF4444"
        : "#737373";

  return (
    <div className="md:col-span-2 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <span style={{ color: accent }}>{icon}</span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          {label}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`${rajdhani.className} text-4xl font-bold tabular-nums`}
          style={{ color: accent }}
        >
          {value}
        </span>
        {delta != null && (
          <span
            className={`${spaceMono.className} text-[11px] font-bold tabular-nums`}
            style={{ color: deltaColor }}
          >
            {formatSigned(delta)}
          </span>
        )}
      </div>
      <div
        className={`${spaceMono.className} mt-1 text-[9px] uppercase tracking-[0.12em] text-[#737373]`}
      >
        {sub} · Δ 7d
      </div>
    </div>
  );
}

function Explainer({
  dotColor,
  title,
  body,
}: {
  dotColor: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-black/40 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}aa` }}
        />
        <span
          className={`${rajdhani.className} text-lg font-bold uppercase leading-none`}
          style={{ color: dotColor }}
        >
          {title}
        </span>
      </div>
      <p className="text-xs text-[#d4d4d4] leading-relaxed">{body}</p>
    </div>
  );
}

function RangeSwitcher({ active }: { active: RangeKey }) {
  return (
    <div className="inline-flex items-center rounded-md border border-[#2a2a2a] bg-black/40 p-0.5">
      {RANGES.map((r) => {
        const isActive = r.key === active;
        return (
          <Link
            key={r.key}
            href={`/training-load?range=${r.key}`}
            prefetch={false}
            className={`${spaceMono.className} px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] rounded transition-colors`}
            style={{
              color: isActive ? NEON : "#a3a3a3",
              background: isActive ? `${NEON}1a` : "transparent",
            }}
          >
            {r.label}
          </Link>
        );
      })}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-[#9ca3af] mb-2">
        Noch keine TRIMP-Werte im gewählten Zeitraum.
      </p>
      <p className={`${spaceMono.className} text-[11px] text-[#737373]`}>
        Synchronisiere Aktivitäten oder wähle einen grösseren Zeitraum.
      </p>
    </div>
  );
}

function formatSigned(n: number): string {
  const s = n.toFixed(1);
  return n > 0 ? `+${s}` : s;
}
