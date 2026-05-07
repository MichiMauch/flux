import { Loader2 } from "lucide-react";
import { spaceMono, rajdhani } from "../components/bento/bento-fonts";

const NEON = "#FF6A00";

const PULSE_CSS = `
  @keyframes feed-skel-bar {
    0%, 100% { opacity: 0.35; transform: scaleX(0.85); }
    50% { opacity: 1; transform: scaleX(1); }
  }
  @keyframes feed-skel-glow {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 1; }
  }
  .feed-skel-row {
    animation: feed-skel-bar 1.2s ease-in-out infinite;
    transform-origin: left center;
  }
  .feed-skel-glow { animation: feed-skel-glow 1.4s ease-in-out infinite; }
`;

interface Props {
  variant: "list" | "editorial";
  rows?: number;
}

export function FeedSkeleton({ variant, rows = 6 }: Props) {
  const rowCount = variant === "editorial" ? Math.min(rows, 3) : rows;
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="relative flex flex-col items-stretch"
    >
      <style>{PULSE_CSS}</style>

      {/* Big, unmistakable loading indicator */}
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <Loader2
          className="h-10 w-10 animate-spin"
          style={{
            color: NEON,
            filter: `drop-shadow(0 0 14px ${NEON}) drop-shadow(0 0 6px ${NEON})`,
          }}
        />
        <div
          className={`${rajdhani.className} feed-skel-glow text-2xl md:text-3xl font-bold uppercase tracking-[0.18em]`}
          style={{
            color: NEON,
            textShadow: `0 0 12px ${NEON}, 0 0 28px ${NEON}66`,
          }}
        >
          Lade Aktivitäten
        </div>
        <div
          className={`${spaceMono.className} text-[10px] uppercase tracking-[0.22em]`}
          style={{ color: "#a3a3a3" }}
        >
          einen Moment bitte…
        </div>
      </div>

      {/* Card placeholders — bright neon borders so they read as
          obviously-empty containers, not random gray boxes */}
      <div className={variant === "editorial" ? "space-y-4" : "space-y-2"}>
        {Array.from({ length: rowCount }).map((_, i) => (
          <div
            key={i}
            className="feed-skel-row rounded-xl border bg-[#0a0a0a]"
            style={{
              borderColor: `${NEON}55`,
              boxShadow: `inset 0 0 0 1px ${NEON}11, 0 0 12px ${NEON}11`,
              height: variant === "editorial" ? "120px" : "80px",
              animationDelay: `${i * 120}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
