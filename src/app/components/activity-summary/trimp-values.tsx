import { Activity } from "lucide-react";
import { interpretTrimp } from "@/lib/trimp";
import { dotsForIntensity, dotsForTrimp } from "@/lib/activity-metrics";

const TRIMP_ZONES = [
  { to: 100, color: "#FFD9CC" },
  { to: 200, color: "#FFB199" },
  { to: 400, color: "#FF8466" },
  { to: 500, color: "#C73A1E" },
];
const TRIMP_MAX = 500;
const INTENSITY_ZONES = [
  { to: 60, color: "#FFD9CC" },
  { to: 120, color: "#FFB199" },
  { to: 180, color: "#FF8466" },
  { to: 240, color: "#C73A1E" },
];
const INTENSITY_MAX = 240;

function zoneFor(
  value: number,
  zones: { to: number; color: string }[],
  max: number
) {
  for (let i = 0; i < zones.length; i++) {
    const from = i === 0 ? 0 : zones[i - 1].to;
    if (value >= from && value < zones[i].to) return zones[i];
  }
  return zones[zones.length - 1];
}

function Dots({ count, color }: { count: number; color: string }) {
  return (
    <div className="flex gap-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-2.5 h-2.5 rounded-full"
          style={{
            background: i < count ? color : "var(--surface-2)",
            boxShadow: i < count ? "none" : "inset 0 0 0 1px var(--border-strong)",
          }}
        />
      ))}
    </div>
  );
}

export function TrimpValues({
  trimp,
  durationSec,
}: {
  trimp: number;
  durationSec: number | null;
}) {
  const label = interpretTrimp(trimp);
  zoneFor(trimp, TRIMP_ZONES, TRIMP_MAX);
  const trimpDots = dotsForTrimp(trimp);
  const hours = durationSec ? durationSec / 3600 : null;
  const perHour = hours && hours > 0 ? trimp / hours : null;
  const activeIntensity =
    perHour != null ? zoneFor(perHour, INTENSITY_ZONES, INTENSITY_MAX) : null;
  const intensityDots = perHour != null ? dotsForIntensity(perHour) : 0;

  return (
    <div className="border-t border-border grid grid-cols-2 divide-x divide-border">
      <div className="px-4 py-3 flex items-center gap-3">
        <Activity className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">
            Cardio Load
          </div>
          <div className="flex items-center gap-2">
            <Dots count={trimpDots} color="var(--brand-dark)" />
            <span className="text-[11px] font-semibold text-foreground">
              {label}
            </span>
          </div>
        </div>
      </div>
      {perHour != null && activeIntensity && (
        <div className="px-4 py-3 flex items-center gap-3">
          <Activity className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1">
              Intensität /h
            </div>
            <div className="flex items-center gap-2">
              <Dots count={intensityDots} color="var(--brand-dark)" />
              <span className="text-[11px] font-semibold text-foreground">
                {interpretTrimp(perHour)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
