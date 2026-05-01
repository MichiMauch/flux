import { spaceMono } from "@/app/components/bento/bento-fonts";
import { SevenSegDisplay } from "@/app/components/bento/seven-seg";

const NEON = "var(--activity-color, #FF6A00)";
const NEON_DIM = "var(--activity-color-dim, #b34600)";
const NEON_ALPHA_99 =
  "color-mix(in srgb, var(--activity-color, #FF6A00) 60%, transparent)";

export function Tile({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function TileLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${spaceMono.className} [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3] mb-2`}
    >
      {children}
    </div>
  );
}

export function SevenSegTile({
  icon,
  value,
  label,
  suffix,
  sub,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  suffix?: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3] mb-2">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        {label}
      </div>
      <div
        className="flex items-end gap-2 leading-none"
        style={{ fontSize: "clamp(36px, 4vw, 56px)" }}
      >
        <SevenSegDisplay value={value} />
        {suffix && (
          <span
            className="[font-family:var(--bento-mono)] font-bold text-[0.4em] lowercase pb-[0.15em]"
            style={{ color: NEON }}
          >
            {suffix}
          </span>
        )}
      </div>
      {sub && (
        <div className="[font-family:var(--bento-mono)] text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3] mt-2">
          {sub}
        </div>
      )}
    </div>
  );
}

export function StatTile({
  icon,
  label,
  value,
  unit,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  className?: string;
}) {
  return (
    <Tile className={className}>
      <div className="flex items-center gap-1.5 [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] mb-2">
        <span className="[&>svg]:h-3 [&>svg]:w-3" style={{ color: NEON_DIM }}>
          {icon}
        </span>
        {label}
      </div>
      <div
        className="flex items-end gap-1.5 leading-none"
        style={{ fontSize: "28px" }}
      >
        <SevenSegDisplay value={value} />
        {unit && (
          <span
            className="[font-family:var(--bento-mono)] font-bold text-[0.4em] lowercase pb-[0.15em]"
            style={{ color: NEON }}
          >
            {unit}
          </span>
        )}
      </div>
    </Tile>
  );
}

export function DotsTile({
  label,
  count,
  icon,
  className,
}: {
  label: string;
  count: number;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Tile className={className}>
      <div className="flex items-center gap-1.5 [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] mb-3">
        {icon && (
          <span className="[&>svg]:h-3 [&>svg]:w-3" style={{ color: NEON_DIM }}>
            {icon}
          </span>
        )}
        {label}
      </div>
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full"
            style={{
              background: i < count ? NEON : "#2a2a2a",
              boxShadow:
                i < count ? `0 0 8px ${NEON_ALPHA_99}` : "inset 0 0 0 1px #2a2a2a",
            }}
          />
        ))}
      </div>
    </Tile>
  );
}
