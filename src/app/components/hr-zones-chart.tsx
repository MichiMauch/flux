import {
  computeHrZones,
  formatZoneDuration,
  type HrSample,
} from "@/lib/hr-zones";
import type { TrimpUser } from "@/lib/trimp";

interface HrZonesChartProps {
  samples: HrSample[];
  user: TrimpUser & {
    aerobicThreshold?: number | null;
    anaerobicThreshold?: number | null;
  };
}

export function HrZonesChart({ samples, user }: HrZonesChartProps) {
  const result = computeHrZones(samples, user);
  if (!result) return null;

  const { zones, source } = result;

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-end">
        <div className="text-[10px] text-muted-foreground">
          {source === "thresholds" ? "Schwellen-basiert" : "%HRmax (Fallback)"}
        </div>
      </div>

      {/* Stacked bar */}
      <div className="flex h-2 w-full overflow-hidden rounded">
        {zones.map((z) => (
          <div
            key={z.index}
            style={{ width: `${z.percent}%`, background: z.color }}
            title={`Z${z.index} · ${z.percent}%`}
          />
        ))}
      </div>

      {/* Zone list */}
      <div className="space-y-1">
        {zones
          .slice()
          .reverse()
          .map((z) => (
            <div
              key={z.index}
              className="flex items-center gap-2 text-[11px] tabular-nums"
            >
              <span
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{ background: z.color }}
              />
              <span className="font-semibold w-5">Z{z.index}</span>
              <span className="text-muted-foreground w-20 truncate">{z.label}</span>
              <span className="text-muted-foreground font-mono">
                {z.minBpm}–{z.maxBpm}
              </span>
              <span className="ml-auto flex items-baseline gap-2">
                <span className="font-mono font-semibold">
                  {formatZoneDuration(z.seconds)}
                </span>
                <span className="text-muted-foreground font-mono w-10 text-right">
                  {z.percent.toFixed(1)}%
                </span>
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
