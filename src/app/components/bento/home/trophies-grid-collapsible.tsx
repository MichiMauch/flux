"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { getTrophy, tierColor } from "@/lib/trophies";
import { TrophyIcon } from "@/app/components/trophy-icon";
import { spaceMono } from "../bento-fonts";

const NEON = "#FF6A00";
const VISIBLE_ROW_SIZE = 6;

interface TrophyRow {
  code: string;
  unlockedAtIso: string;
}

export function TrophiesGridCollapsible({ trophies }: { trophies: TrophyRow[] }) {
  const [open, setOpen] = useState(false);
  if (trophies.length === 0) return null;

  const hidden = trophies.length - VISIBLE_ROW_SIZE;
  const hasMore = hidden > 0;
  const visible = open || !hasMore ? trophies : trophies.slice(0, VISIBLE_ROW_SIZE);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-6 gap-1.5">
        {visible.map((r) => {
          const def = getTrophy(r.code);
          if (!def) return null;
          const color = tierColor(def.tier);
          const glow = color.includes("amber")
            ? "#D97706"
            : color.includes("slate")
              ? "#94A3B8"
              : color.includes("yellow")
                ? "#FDE047"
                : NEON;
          return (
            <span
              key={r.code}
              title={`${def.title} · ${new Date(r.unlockedAtIso).toLocaleDateString("de-CH")}`}
              className="flex aspect-square items-center justify-center rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-0.5"
              style={{ boxShadow: `inset 0 0 6px ${glow}22` }}
            >
              <TrophyIcon
                code={def.code}
                alt={def.title}
                className="h-full w-full object-contain"
              />
            </span>
          );
        })}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`${spaceMono.className} inline-flex items-center justify-center gap-1.5 self-center rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a] transition-colors`}
        >
          {open ? "Weniger anzeigen" : `+${hidden} weitere anzeigen`}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
  );
}
