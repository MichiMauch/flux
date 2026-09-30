"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import type { RoutePoint } from "@/lib/splits";
import {
  buildFlightTrack,
  type FlightSample,
} from "@/lib/route-flight";
import { FlightPlaybackBar, type FlightSpeed } from "./flight-playback-bar";
import { useIsClient } from "@/lib/hooks/use-is-client";

const FlightMapClient = dynamic(() => import("./flight-map-client"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[#0a0a0a] flex items-center justify-center text-[#a3a3a3] [font-family:var(--bento-mono)] text-[10px] uppercase tracking-[0.16em]">
      Lade 3D-Flug…
    </div>
  ),
});

const DEFAULT_NEON = "#FF6A00";

interface Props {
  open: boolean;
  onClose: () => void;
  routeData: RoutePoint[];
  color?: string;
}

const SPEED_DURATION_SEC: Record<FlightSpeed, number> = {
  "30s": 30,
  "60s": 60,
  "120s": 120,
  real: 0, // resolved at runtime from track.durationSec
};

export function ActivityFlightFullscreen({
  open,
  onClose,
  routeData,
  color = DEFAULT_NEON,
}: Props) {
  const mounted = useIsClient();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <FlightContent onClose={onClose} routeData={routeData} color={color} />,
    document.body,
  );
}

function FlightContent({
  onClose,
  routeData,
  color,
}: {
  onClose: () => void;
  routeData: RoutePoint[];
  color: string;
}) {
  const track = useMemo(() => buildFlightTrack(routeData), [routeData]);

  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [followCamera, setFollowCamera] = useState(true);
  const [speed, setSpeed] = useState<FlightSpeed>("60s");
  const [sample, setSample] = useState<FlightSample | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => {
      const lowCpu =
        typeof navigator !== "undefined" &&
        typeof navigator.hardwareConcurrency === "number" &&
        navigator.hardwareConcurrency <= 4;
      setIsMobile(mq.matches || lowCpu);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const durationSec = useMemo(() => {
    if (speed === "real") {
      return track?.durationSec ?? 60;
    }
    return SPEED_DURATION_SEC[speed];
  }, [speed, track]);

  // Playback clock: progress is derived from wall time, so the map's own
  // render loop and the UI read the exact same value for a given frame.
  const clockRef = useRef({ progress: 0, at: 0, durationSec, running: false });

  const getProgress = useCallback((now: number) => {
    const c = clockRef.current;
    if (!c.running || c.durationSec <= 0) return c.progress;
    const elapsed = Math.max(0, now - c.at) / 1000;
    return Math.min(1, c.progress + elapsed / c.durationSec);
  }, []);

  const seek = useCallback((next: number) => {
    clockRef.current.progress = next;
    clockRef.current.at = performance.now();
    setProgress(next);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const c = clockRef.current;
    c.at = performance.now();
    c.durationSec = durationSec;
    c.running = true;
    let raf: number | null = null;
    const tick = (now: number) => {
      const next = getProgress(now);
      setProgress(next);
      if (next >= 1) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
      // Freeze the clock at the current position (pause / speed change).
      c.progress = getProgress(performance.now());
      c.running = false;
    };
  }, [playing, durationSec, getProgress]);

  const handleScrub = (next: number) => {
    if (next >= 1) {
      setPlaying(false);
      seek(1);
      return;
    }
    seek(next);
  };

  const handleTogglePlay = () => {
    if (!playing && progress >= 0.999) seek(0);
    setPlaying((p) => !p);
  };

  return (
    <div
      className="fixed inset-0 z-[1200] bg-black flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="3D-Flug"
    >
      <button
        type="button"
        onClick={onClose}
        className="cursor-pointer absolute top-3 left-3 z-[10] inline-flex items-center justify-center h-9 w-9 rounded-md border border-[#2a2a2a] bg-[#0f0f0f]/90 text-[#a3a3a3] hover:text-white transition-colors backdrop-blur"
        aria-label="3D-Flug schliessen"
        title="Schliessen"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex-1 min-h-0 relative">
        {!track ? (
          <FallbackMessage onClose={onClose}>
            Keine Route fuer 3D-Flug verfuegbar.
          </FallbackMessage>
        ) : error ? (
          <FallbackMessage onClose={onClose}>{error}</FallbackMessage>
        ) : (
          <FlightMapClient
            track={track}
            color={color}
            progress={progress}
            getProgress={getProgress}
            playing={playing}
            followCamera={followCamera}
            isMobile={isMobile}
            onSample={setSample}
            onMapError={(err) =>
              setError(
                err.message ||
                  "3D-Karte konnte nicht geladen werden. WebGL/Mapbox nicht verfuegbar.",
              )
            }
          />
        )}
      </div>

      {track && !error && (
        <FlightPlaybackBar
          playing={playing}
          onTogglePlay={handleTogglePlay}
          progress={progress}
          onScrub={handleScrub}
          speed={speed}
          onSpeedChange={setSpeed}
          followCamera={followCamera}
          onFollowChange={setFollowCamera}
          durationSec={durationSec}
          totalDistanceM={track.totalDistance}
          liveDistanceM={sample?.distanceM ?? 0}
          liveElevation={sample?.elevation ?? track.points[0].elevation ?? 0}
          liveSlope={sample?.slope ?? 0}
          color={color}
        />
      )}
    </div>
  );
}

function FallbackMessage({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="h-full w-full flex items-center justify-center px-6">
      <div className="max-w-sm text-center flex flex-col items-center gap-4">
        <p className="text-white [font-family:var(--bento-mono)] text-[11px] uppercase tracking-[0.16em]">
          {children}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer px-4 py-2 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] text-white [font-family:var(--bento-mono)] text-[10px] uppercase tracking-[0.16em] hover:bg-[#1a1a1a]"
        >
          Schliessen
        </button>
      </div>
    </div>
  );
}
