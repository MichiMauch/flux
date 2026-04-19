import { formatZoneDuration, type HrZone } from "@/lib/hr-zones";
import { Tile, TileLabel } from "./tiles";

const ZONE_NEON = ["#38BDF8", "#39FF14", "#FDE047", "#F97316", "#EC4899"];
const ZONE_LABEL_SHORT = [
  "Z1 Regen",
  "Z2 Aerob light",
  "Z3 Aerob",
  "Z4 Schwelle",
  "Z5 Anaerob",
];

export function HrZonesTile({ zones }: { zones: HrZone[] }) {
  // Order Z5 top → Z1 bottom.
  const ordered = [...zones].reverse();
  const max = Math.max(...zones.map((z) => z.seconds), 1);
  return (
    <Tile className="flex flex-col h-full">
      <TileLabel>Herzfrequenz-Zonen</TileLabel>
      <div className="flex-1 flex flex-col justify-between gap-2 mt-1">
        {ordered.map((z) => {
          const color = ZONE_NEON[z.index - 1];
          const w = Math.max(2, (z.seconds / max) * 100);
          return (
            <div
              key={z.index}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3"
            >
              <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af] w-24">
                {ZONE_LABEL_SHORT[z.index - 1]}
              </div>
              <div className="relative h-4 rounded-sm bg-[#151515] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{
                    width: `${w}%`,
                    background: color,
                    boxShadow: `0 0 8px ${color}99`,
                  }}
                />
              </div>
              <div className="[font-family:var(--bento-mono)] text-[11px] tabular-nums flex items-center gap-2 min-w-[110px] justify-end">
                <span className="text-[#9ca3af]">
                  {z.minBpm}–{z.maxBpm}
                </span>
                <span className="font-bold text-white">
                  {formatZoneDuration(z.seconds)}
                </span>
                <span className="text-[#a3a3a3] w-12 text-right">
                  {z.percent.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Tile>
  );
}
