import { activityTypeColor, activityTypeLabel } from "@/lib/activity-types";
import { spaceMono } from "./bento/bento-fonts";

interface SportChipProps {
  type: string;
  variant?: "default" | "mono";
}

export function SportChip({ type, variant = "default" }: SportChipProps) {
  const color = activityTypeColor(type);
  const base =
    variant === "mono"
      ? `${spaceMono.className} inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.12em]`
      : "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-[0.1em]";
  return (
    <span className={base} style={{ backgroundColor: `${color}1a`, color }}>
      {activityTypeLabel(type)}
    </span>
  );
}
