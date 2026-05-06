import { spaceMono } from "@/app/components/bento/bento-fonts";
import type { PrBadge } from "@/lib/personal-bests";

const RANK_EMOJI: Record<1 | 2 | 3, string> = {
  1: "🏆",
  2: "🥈",
  3: "🥉",
};

export function PersonalBestLine({ items }: { items: PrBadge[] }) {
  if (items.length === 0) return null;

  const sorted = [...items].sort(
    (a, b) => a.rank - b.rank || metricOrder(a.metric) - metricOrder(b.metric)
  );

  return (
    <div
      className={`${spaceMono.className} [font-family:var(--bento-mono)] mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
    >
      {sorted.map((badge, i) => (
        <span key={`${badge.metric}-${badge.rank}`} className="inline-flex items-center gap-1">
          <span aria-hidden="true">{RANK_EMOJI[badge.rank]}</span>
          <span>{badge.label}</span>
          {i < sorted.length - 1 && (
            <span aria-hidden="true" className="ml-2 text-[#525252]">
              ·
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function metricOrder(metric: PrBadge["metric"]): number {
  if (metric === "distance") return 0;
  if (metric === "ascent") return 1;
  return 2;
}
