import { Loader2 } from "lucide-react";
import { rajdhani } from "../components/bento/bento-fonts";

const NEON = "#FF6A00";

const SKEL_CSS = `
  @keyframes skel-pulse {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 1; }
  }
  .skel-block { animation: skel-pulse 1.4s ease-in-out infinite; }
`;

interface Props {
  variant: "list" | "editorial";
  rows?: number;
}

export function FeedSkeleton({ variant, rows = 5 }: Props) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <style>{SKEL_CSS}</style>

      <div className="flex items-center justify-center gap-3 py-6">
        <Loader2
          className="h-6 w-6 animate-spin"
          style={{
            color: NEON,
            filter: `drop-shadow(0 0 10px ${NEON})`,
          }}
        />
        <div
          className={`${rajdhani.className} text-xl font-bold uppercase tracking-[0.18em]`}
          style={{
            color: NEON,
            textShadow: `0 0 10px ${NEON}aa, 0 0 22px ${NEON}55`,
          }}
        >
          Lade Aktivitäten…
        </div>
      </div>

      {variant === "editorial" ? (
        <div className="space-y-6">
          {Array.from({ length: Math.min(rows, 3) }).map((_, i) => (
            <EditorialCardSkeleton key={i} delayMs={i * 120} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {Array.from({ length: rows }).map((_, i) => (
            <ListRowSkeleton key={i} delayMs={i * 90} />
          ))}
        </div>
      )}
    </div>
  );
}

function EditorialCardSkeleton({ delayMs }: { delayMs: number }) {
  const style = { animationDelay: `${delayMs}ms` };
  return (
    <div
      className="rounded-2xl border bg-[#0f0f0f] p-4 md:p-5"
      style={{ borderColor: "#2a2a2a" }}
    >
      {/* Hero image area */}
      <div
        className="skel-block aspect-[16/9] w-full rounded-xl bg-[#262626]"
        style={style}
      />
      {/* Date / sport chip line */}
      <div className="mt-4 flex items-center gap-2">
        <div
          className="skel-block h-4 w-16 rounded bg-[#1f1f1f]"
          style={style}
        />
        <div
          className="skel-block h-3 w-32 rounded bg-[#1a1a1a]"
          style={style}
        />
      </div>
      {/* Title (big bar) */}
      <div
        className="skel-block mt-3 h-7 w-3/4 rounded bg-[#2f2f2f]"
        style={style}
      />
      {/* Meta row: distance · duration · ascent · hr */}
      <div className="mt-3 flex flex-wrap gap-3">
        <div
          className="skel-block h-4 w-20 rounded bg-[#1f1f1f]"
          style={style}
        />
        <div
          className="skel-block h-4 w-16 rounded bg-[#1f1f1f]"
          style={style}
        />
        <div
          className="skel-block h-4 w-14 rounded bg-[#1f1f1f]"
          style={style}
        />
        <div
          className="skel-block h-4 w-16 rounded bg-[#1f1f1f]"
          style={style}
        />
      </div>
    </div>
  );
}

function ListRowSkeleton({ delayMs }: { delayMs: number }) {
  const style = { animationDelay: `${delayMs}ms` };
  return (
    <div
      className="grid grid-cols-[140px_1fr] md:grid-cols-[220px_1fr] gap-3 md:gap-4 rounded-xl border bg-[#0f0f0f] p-2"
      style={{ borderColor: "#2a2a2a" }}
    >
      {/* Thumbnail / map preview */}
      <div
        className="skel-block aspect-[16/10] rounded-lg bg-[#262626]"
        style={style}
      />
      <div className="flex flex-col justify-center gap-2 py-1">
        {/* Sport chip + date */}
        <div className="flex items-center gap-2">
          <div
            className="skel-block h-3 w-12 rounded bg-[#1f1f1f]"
            style={style}
          />
          <div
            className="skel-block h-3 w-28 rounded bg-[#1a1a1a]"
            style={style}
          />
        </div>
        {/* Title */}
        <div
          className="skel-block h-5 w-3/4 rounded bg-[#2f2f2f]"
          style={style}
        />
        {/* Metrics */}
        <div className="flex flex-wrap gap-3">
          <div
            className="skel-block h-3 w-16 rounded bg-[#1f1f1f]"
            style={style}
          />
          <div
            className="skel-block h-3 w-14 rounded bg-[#1f1f1f]"
            style={style}
          />
          <div
            className="skel-block h-3 w-12 rounded bg-[#1f1f1f]"
            style={style}
          />
        </div>
      </div>
    </div>
  );
}

