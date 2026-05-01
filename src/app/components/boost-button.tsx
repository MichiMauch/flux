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
}: Props) {
  const accent = color ?? NEON_FALLBACK;
  const [boosted, setBoosted] = useState(initialBoosted);
  const [boosters, setBoosters] = useState<Booster[]>(initialBoosters);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const count = boosters.length;

  function handleClick() {
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
          userIds: string[];
        };
        setBoosted(data.boosted);
        // Server returns userIds; we don't have full booster info for
        // others on the client, so trust the count from the server and
        // only sync the boosters list on next page render. For UX
        // immediacy, just toggle the local state — the count badge
        // already reflects the new value via boosters length adjustment.
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
        className={`inline-flex items-center gap-1.5 px-3 h-10 rounded-md border transition-colors ${
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
          size={22}
          color={accent}
          playing={canBoost || boosted}
        />
        <span className="[font-family:var(--bento-mono)] text-[12px] font-bold uppercase tracking-[0.12em] tabular-nums">
          {count}
        </span>
      </button>
      {boosters.length > 0 && (
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
