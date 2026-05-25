"use client";

import { Pause, Play } from "lucide-react";
import { formatPlaybackTime } from "@/lib/route-flight";

export type FlightSpeed = "30s" | "60s" | "120s" | "real";

interface Props {
  playing: boolean;
  onTogglePlay: () => void;
  progress: number;
  onScrub: (next: number) => void;
  speed: FlightSpeed;
  onSpeedChange: (next: FlightSpeed) => void;
  followCamera: boolean;
  onFollowChange: (next: boolean) => void;
  durationSec: number;
  totalDistanceM: number;
  liveDistanceM: number;
  liveElevation: number;
  liveSlope: number;
  color: string;
}

const SPEED_OPTIONS: { value: FlightSpeed; label: string }[] = [
  { value: "30s", label: "30s" },
  { value: "60s", label: "1 min" },
  { value: "120s", label: "2 min" },
  { value: "real", label: "Real" },
];

export function FlightPlaybackBar({
  playing,
  onTogglePlay,
  progress,
  onScrub,
  speed,
  onSpeedChange,
  followCamera,
  onFollowChange,
  durationSec,
  totalDistanceM,
  liveDistanceM,
  liveElevation,
  liveSlope,
  color,
}: Props) {
  const elapsedSec = durationSec * progress;
  const kmLive = (liveDistanceM / 1000).toFixed(1);
  const kmTotal = (totalDistanceM / 1000).toFixed(1);
  const eleStr = Number.isFinite(liveElevation)
    ? Math.round(liveElevation).toString()
    : "–";
  const slopeStr = Number.isFinite(liveSlope) ? liveSlope.toFixed(1) : "–";

  return (
    <div className="border-t border-[#2a2a2a] bg-[#0f0f0f]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0f0f0f]/85">
      <div className="px-3 sm:px-5 py-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTogglePlay}
            className="cursor-pointer inline-flex items-center justify-center h-10 w-10 rounded-full border border-[#2a2a2a] transition-colors hover:brightness-110"
            style={{
              background: color,
              color: "#0a0a0a",
              boxShadow: `0 0 18px ${color}55`,
            }}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="h-4 w-4" fill="currentColor" />
            ) : (
              <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />
            )}
          </button>

          <div className="flex-1 flex items-center gap-3 min-w-0">
            <span className="[font-family:var(--bento-mono)] text-[11px] text-white tabular-nums shrink-0">
              {formatPlaybackTime(elapsedSec)}
            </span>
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={(e) => onScrub(Number(e.target.value) / 1000)}
              className="flex-1 h-1.5 appearance-none bg-[#1a1a1a] rounded-full outline-none cursor-pointer accent-current"
              style={{ color }}
              aria-label="Position im Flug"
            />
            <span className="[font-family:var(--bento-mono)] text-[11px] text-[#a3a3a3] tabular-nums shrink-0">
              {formatPlaybackTime(durationSec)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer [font-family:var(--bento-mono)] text-[10px] uppercase tracking-[0.16em] text-[#a3a3a3]">
              <span>Tempo</span>
              <select
                value={speed}
                onChange={(e) => onSpeedChange(e.target.value as FlightSpeed)}
                className="cursor-pointer bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 text-white text-[11px] [font-family:var(--bento-mono)] uppercase tracking-[0.14em] focus:outline-none focus:border-[#3a3a3a]"
              >
                {SPEED_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 cursor-pointer [font-family:var(--bento-mono)] text-[10px] uppercase tracking-[0.16em] text-[#a3a3a3] select-none">
              <input
                type="checkbox"
                checked={followCamera}
                onChange={(e) => onFollowChange(e.target.checked)}
                className="cursor-pointer h-3.5 w-3.5 rounded border-[#2a2a2a] bg-[#0a0a0a]"
                style={{ accentColor: color }}
              />
              <span>Kamera folgt</span>
            </label>
          </div>

          <div className="flex items-center gap-4 [font-family:var(--bento-mono)] text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]">
            <Metric label="km">
              <span className="text-white tabular-nums">{kmLive}</span>
              <span className="text-[#555]"> / {kmTotal}</span>
            </Metric>
            <Metric label="m üNN">
              <span className="text-white tabular-nums">{eleStr}</span>
            </Metric>
            <Metric label="Steigung">
              <span className="text-white tabular-nums">{slopeStr}%</span>
            </Metric>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span>{label}</span>
      <span className="text-[12px]">{children}</span>
    </div>
  );
}
