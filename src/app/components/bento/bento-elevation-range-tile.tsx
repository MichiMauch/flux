import { ChevronsDown, ChevronsUp } from "lucide-react";
import type { RoutePoint } from "@/lib/splits";
import { Tile, TileLabel } from "@/app/activity/[id]/tiles";
import { SevenSegDisplay } from "@/app/components/bento/seven-seg";

const NEON = "var(--activity-color, #FF6A00)";
const NEON_DIM = "var(--activity-color-dim, #b34600)";

function getExtremes(
  route: RoutePoint[] | null | undefined
): { highest: number; lowest: number } | null {
  if (!route || route.length === 0) return null;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const p of route) {
    const e = p.elevation;
    if (typeof e === "number" && Number.isFinite(e)) {
      if (e < lo) lo = e;
      if (e > hi) hi = e;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return { lowest: Math.round(lo), highest: Math.round(hi) };
}

export function BentoElevationRangeTile({
  route,
  className,
}: {
  route: RoutePoint[];
  className?: string;
}) {
  const extremes = getExtremes(route);
  if (!extremes) return null;
  const delta = extremes.highest - extremes.lowest;

  return (
    <Tile className={className}>
      <div className="flex items-center justify-between mb-3">
        <TileLabel>Höhe</TileLabel>
        <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]">
          Δ <span className="text-white tabular-nums">{delta} m</span>
        </div>
      </div>
      <div className="flex items-stretch gap-4">
        <Entry
          icon={<ChevronsUp />}
          label="Höchster"
          value={extremes.highest}
        />
        <div className="w-px self-stretch bg-[#1a1a1a]" />
        <Entry
          icon={<ChevronsDown />}
          label="Tiefster"
          value={extremes.lowest}
        />
      </div>
    </Tile>
  );
}

function Entry({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]">
        <span className="[&>svg]:h-3 [&>svg]:w-3" style={{ color: NEON_DIM }}>
          {icon}
        </span>
        {label}
      </div>
      <div
        className="mt-2 flex items-end gap-1.5 leading-none"
        style={{ fontSize: "28px" }}
      >
        <SevenSegDisplay value={String(value)} />
        <span
          className="[font-family:var(--bento-mono)] font-bold text-[0.4em] lowercase pb-[0.15em]"
          style={{ color: NEON }}
        >
          m
        </span>
      </div>
    </div>
  );
}
