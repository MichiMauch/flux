import { spaceMono } from "../components/bento/bento-fonts";

const PULSE_CSS = `
  @keyframes feed-skeleton-pulse {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 0.9; }
  }
  .feed-skel { animation: feed-skeleton-pulse 1.4s ease-in-out infinite; }
`;

interface Props {
  variant: "list" | "editorial";
  rows?: number;
}

export function FeedSkeleton({ variant, rows = 5 }: Props) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-8">
      <style>{PULSE_CSS}</style>
      <div className="flex items-baseline gap-3">
        <div className="feed-skel h-3 w-24 rounded bg-[#1f1f1f]" />
        <div className="feed-skel h-3 w-10 rounded bg-[#1a1a1a]" />
      </div>

      {variant === "list" ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[140px_1fr] md:grid-cols-[220px_1fr] gap-3 md:gap-4 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-2"
            >
              <div className="feed-skel aspect-[16/10] rounded-lg bg-[#141414]" />
              <div className="flex flex-col justify-center gap-2">
                <div className="feed-skel h-3 w-32 rounded bg-[#1a1a1a]" />
                <div className="feed-skel h-5 w-3/4 rounded bg-[#1f1f1f]" />
                <div className="feed-skel h-3 w-1/2 rounded bg-[#161616]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          {Array.from({ length: Math.min(rows, 3) }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-4 md:p-6"
            >
              <div className="feed-skel aspect-[16/9] w-full rounded-xl bg-[#141414]" />
              <div className="mt-4 space-y-2">
                <div className="feed-skel h-3 w-32 rounded bg-[#1a1a1a]" />
                <div className="feed-skel h-7 w-2/3 rounded bg-[#1f1f1f]" />
                <div className="feed-skel h-3 w-1/2 rounded bg-[#161616]" />
              </div>
            </div>
          ))}
        </div>
      )}

      <p
        className={`${spaceMono.className} text-center text-[10px] uppercase tracking-[0.16em] text-[#5a5a5a]`}
      >
        Aktivitäten werden geladen…
      </p>
    </div>
  );
}
