import { Flame } from "lucide-react";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";
import { getStreak } from "@/lib/cache/home-stats";

const NEON = "#FF6A00";

export async function BentoDashboardStreak({ userId }: { userId: string }) {
  const { current, longest } = await getStreak(userId);

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-3 h-full flex flex-col">
      <div className="flex items-center mb-2">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Flame className="h-3 w-3" style={{ color: NEON }} />
          Streak
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-baseline gap-1.5" style={{ fontSize: "48px" }}>
          <SevenSegDisplay value={String(current)} />
          <span
            className={`${spaceMono.className} text-[0.32em] font-bold lowercase`}
            style={{ color: NEON }}
          >
            tage
          </span>
        </div>
      </div>
      <div
        className={`${spaceMono.className} text-[9px] uppercase tracking-[0.12em] text-[#a3a3a3] tabular-nums text-center`}
      >
        Rekord: <span className="text-white font-bold">{longest} Tage</span>
      </div>
    </div>
  );
}
