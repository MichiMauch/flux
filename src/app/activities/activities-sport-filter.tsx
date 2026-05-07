"use client";

import { HelpCircle } from "lucide-react";
import { spaceMono } from "../components/bento/bento-fonts";
import { ChipLottie } from "../stats/chip-lottie";
import { activityTypeLabel } from "@/lib/activity-types";
import { sportLottie } from "./filters";
import { useActivitiesNav } from "./activities-nav-guard";

const NEON = "#FF6A00";
const DIM = "#a3a3a3";

interface ActivitiesSportFilterProps {
  sport: string | null;
  availableSports: string[];
  basePath?: string;
}

function buildHref(basePath: string, sport: string | null): string {
  if (!sport) return basePath;
  const p = new URLSearchParams();
  p.set("sport", sport);
  return `${basePath}?${p.toString()}`;
}

export function ActivitiesSportFilter({
  sport,
  availableSports,
  basePath = "/activities",
}: ActivitiesSportFilterProps) {
  return (
    <div
      className={`${spaceMono.className} flex items-center gap-2 text-[11px] overflow-x-auto whitespace-nowrap -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
    >
      <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.22em] text-[#a3a3a3]">
        Sportart
      </span>
      <div className="flex gap-1">
        <Chip
          href={buildHref(basePath, null)}
          active={sport === null}
          label="Alle"
          icon={
            <ChipLottie
              file="all-skins"
              tint={sport === null ? NEON : DIM}
            />
          }
        />
        {availableSports.map((s) => {
          const active = sport === s;
          const lottie = sportLottie(s);
          return (
            <Chip
              key={s}
              href={buildHref(basePath, active ? null : s)}
              active={active}
              label={activityTypeLabel(s)}
              icon={
                lottie ? (
                  <ChipLottie file={lottie} tint={active ? NEON : DIM} />
                ) : (
                  <HelpCircle
                    className="h-[14px] w-[14px]"
                    style={{ color: active ? NEON : DIM }}
                  />
                )
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  label,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  icon?: React.ReactNode;
}) {
  const { navigate } = useActivitiesNav();
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className="shrink-0 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition"
      style={
        active
          ? {
              borderColor: NEON,
              color: NEON,
              background: "rgba(255,106,0,0.08)",
              boxShadow: `0 0 8px ${NEON}66`,
              textShadow: `0 0 4px ${NEON}aa`,
            }
          : {
              borderColor: "#2a2a2a",
              color: DIM,
              background: "#0f0f0f",
            }
      }
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
