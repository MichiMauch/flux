"use client";

import { useState, useTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BoostLottie } from "./boost-lottie";

const NEON_FALLBACK = "#FF6A00";

export interface Booster {
  id: string;
  name: string;
  image: string | null;
}

interface Props {
  activityId: string;
  initialBoosted: boolean;
  initialBoosters: Booster[];
  canBoost: boolean;
  color?: string;
  compact?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function BoostButton({
  activityId,
  initialBoosted,
  initialBoosters,
  canBoost,
  color,
  compact = false,
}: Props) {
  const accent = color ?? NEON_FALLBACK;
  const [boosted, setBoosted] = useState(initialBoosted);
  const [boosters, setBoosters] = useState<Booster[]>(initialBoosters);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const count = boosters.length;

  function handleClick(e: React.MouseEvent) {
    // The button may be embedded inside a wrapping <Link> (e.g. on the
    // stream-card). Prevent the navigation + bubbling so a click on the
    // boost button only toggles the boost.
    e.preventDefault();
    e.stopPropagation();
    if (!canBoost || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/activities/${activityId}/boost`, {
          method: "POST",
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as {
          boosted: boolean;
          count: number;
          boosters: Booster[];
        };
        setBoosted(data.boosted);
        setBoosters(data.boosters);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Boost fehlgeschlagen");
      }
    });
  }

  if (!canBoost && count === 0) return null;

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={!canBoost || pending}
        aria-label={boosted ? "Boost zurücknehmen" : "Boosten"}
        className={`inline-flex items-center gap-2 rounded-md border transition-colors ${
          compact ? "h-11 px-3.5" : "h-10 px-3"
        } ${
          boosted
            ? "border-transparent"
            : "border-[#2a2a2a] hover:bg-[#1a1a1a]"
        } ${!canBoost ? "cursor-default opacity-70" : "cursor-pointer"}`}
        style={
          boosted
            ? {
                background: `color-mix(in srgb, ${accent} 18%, transparent)`,
                boxShadow: `0 0 0 1px ${accent}`,
                color: accent,
              }
            : { color: accent }
        }
      >
        <BoostLottie
          file="rocket"
          size={compact ? 26 : 22}
          color={accent}
          playing={canBoost || boosted}
        />
        <span
          className={`[font-family:var(--bento-mono)] font-bold uppercase tracking-[0.12em] tabular-nums ${
            compact ? "text-[13px]" : "text-[12px]"
          }`}
        >
          {count}
        </span>
      </button>
      {boosters.length > 0 && !compact && (
        <div className="flex -space-x-1.5">
          {boosters.slice(0, 3).map((b) => (
            <Avatar
              key={b.id}
              className="h-6 w-6 ring-2 ring-[#0f0f0f]"
              title={b.name}
            >
              {b.image && <AvatarImage src={b.image} alt={b.name} />}
              <AvatarFallback className="text-[9px] font-bold">
                {getInitials(b.name)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      )}
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
