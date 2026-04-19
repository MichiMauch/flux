import { Flame } from "lucide-react";

export function HeroStat({
  value,
  unit,
  label,
  withDivider,
}: {
  value: string;
  unit: string;
  label: string;
  withDivider?: boolean;
}) {
  return (
    <div className={`min-w-0 ${withDivider ? "border-l border-border pl-3" : ""}`}>
      <div className="flex items-baseline gap-1 tabular-nums">
        <span className="text-[clamp(22px,3.2vw,30px)] font-bold tracking-[-0.03em] leading-none">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-muted-foreground">{unit}</span>
        )}
      </div>
      <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function Mini({
  icon,
  label,
  value,
  unit,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-r border-b border-border last:border-r-0 [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r sm:[&:nth-child(3n)]:border-r-0 md:[&:nth-child(3n)]:border-r md:[&:nth-child(4n)]:border-r-0 -mr-px -mb-px">
      <span
        className={`flex-shrink-0 ${highlight ? "text-brand" : "text-muted-foreground"}`}
      >
        <span className="[&>svg]:w-3 [&>svg]:h-3">{icon}</span>
      </span>
      <div className="min-w-0">
        <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground leading-tight">
          {label}
        </div>
        <div className="flex items-baseline gap-0.5 mt-0.5 tabular-nums">
          <span
            className={`text-sm font-bold tracking-[-0.02em] leading-none ${
              highlight ? "text-brand" : ""
            }`}
          >
            {value}
          </span>
          {unit && (
            <span className="text-[10px] font-medium text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function MacroTile({
  carb,
  fat,
  protein,
}: {
  carb: number;
  fat: number;
  protein: number;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 col-span-2 border-b border-border -mb-px">
      <span className="flex-shrink-0 text-muted-foreground">
        <Flame className="w-3 h-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground leading-tight">
          KH · Fett · Eiweiss
        </div>
        <div className="flex h-1 rounded-full overflow-hidden mt-1 bg-surface">
          <div style={{ width: `${carb}%`, background: "#FFB199" }} />
          <div style={{ width: `${fat}%`, background: "#F0E4D4" }} />
          <div style={{ width: `${protein}%`, background: "#C73A1E" }} />
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
          {carb}/{fat}/{protein}
        </div>
      </div>
    </div>
  );
}
