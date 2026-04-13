import { Activity } from "lucide-react";
import { interpretTrimp } from "@/lib/trimp";

interface TrimpCardProps {
  trimp: number;
  durationSec?: number | null;
}

const ZONES = [
  { label: "Leicht", from: 0, to: 100, color: "#FFD9CC" },
  { label: "Moderat", from: 100, to: 200, color: "#FFB199" },
  { label: "Hoch", from: 200, to: 400, color: "#FF8466" },
  { label: "Sehr hoch", from: 400, to: 500, color: "#C73A1E" },
];
const SCALE_MAX = 500;

const INTENSITY_ZONES = [
  { label: "Leicht", from: 0, to: 60, color: "#FFD9CC" },
  { label: "Moderat", from: 60, to: 120, color: "#FFB199" },
  { label: "Hoch", from: 120, to: 180, color: "#FF8466" },
  { label: "Sehr hoch", from: 180, to: 240, color: "#C73A1E" },
];
const INTENSITY_MAX = 240;

export function TrimpCard({ trimp, durationSec }: TrimpCardProps) {
  const label = interpretTrimp(trimp);
  const overflow = trimp > SCALE_MAX;
  const capped = Math.min(trimp, SCALE_MAX);
  const markerPct = (capped / SCALE_MAX) * 100;
  const activeZone = ZONES.find((z) => trimp >= z.from && trimp < z.to) ?? ZONES[ZONES.length - 1];

  const hours = durationSec ? durationSec / 3600 : null;
  const perHour = hours && hours > 0 ? trimp / hours : null;
  const perHourCapped = perHour != null ? Math.min(perHour, INTENSITY_MAX) : null;
  const perHourPct = perHourCapped != null ? (perHourCapped / INTENSITY_MAX) * 100 : 0;
  const activeIntensity =
    perHour != null
      ? INTENSITY_ZONES.find((z) => perHour >= z.from && perHour < z.to) ??
        INTENSITY_ZONES[INTENSITY_ZONES.length - 1]
      : null;

  return (
    <div className="rounded-lg border p-4 space-y-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Activity className="h-4 w-4" />
        <span className="text-xs">TRIMP · Cardio Load</span>
      </div>

      {/* Total TRIMP */}
      <div>
        <div className="flex items-end justify-between gap-4 mb-2">
          <div>
            <div className="text-[11px] text-muted-foreground">Gesamtlast</div>
            <div
              className="text-sm font-medium"
              style={{ color: activeZone.color }}
            >
              {label}
            </div>
          </div>
          <div className="text-3xl font-semibold leading-none">
            {overflow ? ">" : ""}{Math.round(trimp)}
          </div>
        </div>
        <div className="relative">
          <div className="flex h-2 w-full overflow-hidden rounded-full">
            {ZONES.map((z) => (
              <div
                key={z.label}
                style={{
                  width: `${((z.to - z.from) / SCALE_MAX) * 100}%`,
                  backgroundColor: z.color,
                  opacity: z.label === activeZone.label ? 1 : 0.25,
                }}
              />
            ))}
          </div>
          <div
            className="absolute -top-1 h-4 w-0.5 bg-foreground"
            style={{ left: `calc(${markerPct}% - 1px)` }}
          />
        </div>
        <div className="mt-2 flex text-[10px] text-muted-foreground">
          {ZONES.map((z) => (
            <div
              key={z.label}
              style={{ width: `${((z.to - z.from) / SCALE_MAX) * 100}%` }}
              className="text-center"
            >
              {z.from}
            </div>
          ))}
          <div className="text-right" style={{ width: 0 }}>
            <span className="-ml-3">{SCALE_MAX}+</span>
          </div>
        </div>
        <div className="flex text-[10px] text-muted-foreground">
          {ZONES.map((z) => (
            <div
              key={z.label}
              style={{ width: `${((z.to - z.from) / SCALE_MAX) * 100}%` }}
              className="text-center"
            >
              {z.label}
            </div>
          ))}
        </div>
      </div>

      {/* Intensity TRIMP/h */}
      {perHour != null && activeIntensity && (
        <div className="pt-3 border-t">
          <div className="flex items-end justify-between gap-4 mb-2">
            <div>
              <div className="text-[11px] text-muted-foreground">
                Intensität (TRIMP/h)
              </div>
              <div
                className="text-sm font-medium"
                style={{ color: activeIntensity.color }}
              >
                {activeIntensity.label}
              </div>
            </div>
            <div className="text-xl font-semibold leading-none">
              {Math.round(perHour)}
              <span className="text-xs text-muted-foreground font-normal ml-1">
                /h
              </span>
            </div>
          </div>
          <div className="relative">
            <div className="flex h-2 w-full overflow-hidden rounded-full">
              {INTENSITY_ZONES.map((z) => (
                <div
                  key={z.label}
                  style={{
                    width: `${((z.to - z.from) / INTENSITY_MAX) * 100}%`,
                    backgroundColor: z.color,
                    opacity: z.label === activeIntensity.label ? 1 : 0.25,
                  }}
                />
              ))}
            </div>
            <div
              className="absolute -top-1 h-4 w-0.5 bg-foreground"
              style={{ left: `calc(${perHourPct}% - 1px)` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
