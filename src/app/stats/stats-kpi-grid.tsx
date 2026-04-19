import type { LucideIcon } from "lucide-react";
import { spaceMono } from "../components/bento/bento-fonts";
import { LedValue } from "../components/bento/led-value";

export interface StatsKpi {
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
}

export function StatsKpiGrid({ kpis }: { kpis: StatsKpi[] }) {
  return (
    <div className="grid flex-1 grid-cols-2 items-stretch gap-3 md:grid-cols-3">
      {kpis.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.label}
            className="flex flex-col items-center justify-center rounded-lg border border-[#2a2a2a] bg-black/40 p-3 text-center"
          >
            <Icon
              className="mb-1 h-4 w-4"
              style={{
                color: m.color,
                filter: `drop-shadow(0 0 4px ${m.color}99)`,
              }}
            />
            <div
              className="flex justify-center leading-none"
              style={{ fontSize: "1.6rem" }}
            >
              <LedValue
                value={m.value}
                color="#ffffff"
                textColor="#FF6A00"
              />
            </div>
            <div
              className={`${spaceMono.className} mt-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3]`}
            >
              {m.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
