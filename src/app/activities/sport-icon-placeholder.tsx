import { createElement } from "react";
import { activityTypeLabel } from "@/lib/activity-types";
import { activityTypeIcon } from "@/lib/activity-icon";
import { spaceMono } from "@/app/components/bento/bento-fonts";

interface Props {
  type: string;
  color: string;
}

export function SportIconPlaceholder({ type, color }: Props) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1.5"
      style={{
        background: `radial-gradient(circle at 50% 45%, ${color}22, transparent 70%), #0a0a0a`,
      }}
    >
      {/* createElement statt <Icon />: activityTypeIcon wählt nur aus festen
          Lucide-Icons, der Compiler kann das aber nicht von einer pro Render
          neu erzeugten Komponente unterscheiden. */}
      {createElement(activityTypeIcon(type), {
        className: "h-8 w-8 md:h-10 md:w-10",
        style: {
          color,
          filter: `drop-shadow(0 0 8px ${color}aa) drop-shadow(0 0 16px ${color}66)`,
        },
        strokeWidth: 1.5,
      })}
      <span
        className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.18em]`}
        style={{ color: `${color}cc` }}
      >
        {activityTypeLabel(type)}
      </span>
    </div>
  );
}
