import Link from "next/link";
import { Sparkles } from "lucide-react";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";
import { FormSparkline } from "./form-sparkline";
import { computeReadiness, interpretReadiness } from "@/lib/training-load";
import { getForm } from "@/lib/cache/home-stats";

const NEON = "#FF6A00";

export async function BentoDashboardForm({ userId }: { userId: string }) {
  const { series, hasData, visibleDays } = await getForm(userId);
  const latest = series[series.length - 1];

  const cardClass =
    "rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col hover:border-[#3a3a3a] transition-colors";

  if (!latest || !hasData) {
    return (
      <Link href="/training-load" className={cardClass}>
        <Header />
        <div
          className={`flex-1 flex items-center justify-center ${spaceMono.className} text-xs text-[#a3a3a3]`}
        >
          Keine TRIMP-Daten
        </div>
      </Link>
    );
  }

  const readiness = computeReadiness(latest.tsb);
  const interp = interpretReadiness(latest.tsb);

  return (
    <Link href="/training-load" className={cardClass}>
      <Header stateLabel={interp.headline} stateColor={interp.color} />
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-2" style={{ fontSize: "36px" }}>
          <SevenSegDisplay value={String(readiness)} />
          <span
            className={`${spaceMono.className} text-[0.3em] font-bold uppercase tracking-wider`}
            style={{ color: interp.color }}
          >
            / 100
          </span>
        </div>
      </div>
      <FormSparkline points={series} zoneColor={interp.color} />
      <div
        className={`${spaceMono.className} mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.1em] text-[#a3a3a3] tabular-nums`}
      >
        <span>
          Fit <span className="text-white font-bold">{latest.ctl.toFixed(0)}</span>
        </span>
        <span className="text-[#3a3a3a]">·</span>
        <span>
          Müde <span className="text-white font-bold">{latest.atl.toFixed(0)}</span>
        </span>
        <span className="text-[#3a3a3a]">·</span>
        <span>{visibleDays}d</span>
      </div>
    </Link>
  );
}

function Header({
  stateLabel,
  stateColor,
}: { stateLabel?: string; stateColor?: string } = {}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span
        className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
      >
        <Sparkles className="h-3 w-3" style={{ color: NEON }} />
        Bereitschaft
      </span>
      {stateLabel && (
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] tabular-nums`}
          style={{ color: stateColor }}
        >
          {stateLabel}
        </span>
      )}
    </div>
  );
}
