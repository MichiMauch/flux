import { spaceMono } from "../components/bento/bento-fonts";

const NEON = "#FF6A00";

const PULSE_CSS = `
  @keyframes feed-skeleton-pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
  @keyframes feed-skeleton-shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .feed-skel {
    animation: feed-skeleton-pulse 1.4s ease-in-out infinite;
    background: linear-gradient(
      90deg,
      #232323 0%,
      #2f2f2f 50%,
      #232323 100%
    );
    background-size: 800px 100%;
    background-repeat: no-repeat;
  }
  .feed-skel-shimmer {
    animation: feed-skeleton-shimmer 1.6s linear infinite;
  }
`;

interface Props {
  variant: "list" | "editorial";
  rows?: number;
}

export function FeedSkeleton({ variant, rows = 5 }: Props) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <style>{PULSE_CSS}</style>
      <div className="flex items-baseline gap-3">
        <div className="feed-skel feed-skel-shimmer h-3 w-28 rounded" />
        <div className="feed-skel h-3 w-12 rounded" />
      </div>

      {variant === "list" ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[140px_1fr] md:grid-cols-[220px_1fr] gap-3 md:gap-4 rounded-xl border border-[#3a3a3a] bg-[#141414] p-2"
            >
              <div className="feed-skel feed-skel-shimmer aspect-[16/10] rounded-lg" />
              <div className="flex flex-col justify-center gap-2">
                <div className="feed-skel h-3 w-32 rounded" />
                <div className="feed-skel feed-skel-shimmer h-5 w-3/4 rounded" />
                <div className="feed-skel h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {Array.from({ length: Math.min(rows, 3) }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#3a3a3a] bg-[#141414] p-4 md:p-6"
            >
              <div className="feed-skel feed-skel-shimmer aspect-[16/9] w-full rounded-xl" />
              <div className="mt-4 space-y-2">
                <div className="feed-skel h-3 w-32 rounded" />
                <div className="feed-skel feed-skel-shimmer h-7 w-2/3 rounded" />
                <div className="feed-skel h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      <p
        className={`${spaceMono.className} text-center text-[10px] font-bold uppercase tracking-[0.18em]`}
        style={{ color: NEON, textShadow: `0 0 6px ${NEON}66` }}
      >
        Aktivitäten werden geladen…
      </p>
    </div>
  );
}
