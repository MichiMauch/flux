import { ChipLottie } from "../stats/chip-lottie";

const NEON = "#FF6A00";

interface Props {
  /** Kept for API compatibility (callers pass it). No visual effect now. */
  variant?: "list" | "editorial";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function FeedSkeleton(_props: Props = {}) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex items-center justify-center py-10"
    >
      <span
        style={{
          filter: `drop-shadow(0 0 8px ${NEON}) drop-shadow(0 0 16px ${NEON}66)`,
        }}
      >
        <ChipLottie file="walk" tint={NEON} size={36} />
      </span>
    </div>
  );
}
