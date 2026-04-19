import type { ReactNode } from "react";
import { spaceMono } from "./bento-fonts";

interface BentoTileProps {
  label?: string;
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: "default" | "none" | "compact";
}

export function BentoTile({
  label,
  title,
  right,
  children,
  className = "",
  padding = "default",
}: BentoTileProps) {
  const padClass =
    padding === "none" ? "" : padding === "compact" ? "p-3" : "p-4";

  return (
    <section
      className={`rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] ${padClass} ${className}`}
    >
      {(label || title || right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            {label && (
              <div
                className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.2em] text-[#a3a3a3]`}
              >
                {label}
              </div>
            )}
            {title && (
              <h2 className="text-base font-semibold tracking-[-0.01em] text-white">
                {title}
              </h2>
            )}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
