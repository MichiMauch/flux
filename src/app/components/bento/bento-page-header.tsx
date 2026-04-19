import type { ReactNode } from "react";
import { rajdhani, spaceMono } from "./bento-fonts";

const NEON = "#FF6A00";

interface BentoPageHeaderProps {
  section: string;
  title: string;
  right?: ReactNode;
  titleScale?: "default" | "compact";
}

export function BentoPageHeader({
  section,
  title,
  right,
  titleScale = "default",
}: BentoPageHeaderProps) {
  const dateLabel = new Date()
    .toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();

  const fontSize =
    titleScale === "compact"
      ? "clamp(32px, 5vw, 64px)"
      : "clamp(40px, 7vw, 96px)";

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-[#2a2a2a] pb-4 gap-3 sm:gap-4">
      <div className="min-w-0">
        <div
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.3em] text-[#a3a3a3] mb-1`}
        >
          ► FLUX // {section.toUpperCase()} · {dateLabel}
        </div>
        <h1
          className={`${rajdhani.className} font-bold uppercase leading-none tracking-[-0.02em] break-words`}
          style={{
            fontSize,
            color: NEON,
            textShadow: `0 0 18px ${NEON}88, 0 0 40px ${NEON}55, 0 0 80px ${NEON}22`,
          }}
        >
          {title}
        </h1>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
