"use client";

import { useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { spaceMono } from "../components/bento/bento-fonts";
import { MultiRouteMapSection } from "../components/multi-route-map-section";
import type { MultiRouteEntry } from "../components/multi-route-map-client";
import { TourMapFullscreen } from "../components/bento/tours/tour-map-fullscreen";
import {
  NEON,
  CYAN,
  GREEN,
  YELLOW,
  RED,
  MAGENTA,
  PURPLE,
  BLUE,
} from "@/lib/sport-colors";
import type { TourRoute } from "./data";

const TOUR_COLORS = [NEON, CYAN, GREEN, YELLOW, MAGENTA, BLUE, RED, PURPLE];

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; routes: MultiRouteEntry[] };

/** Öffnet die grosse Karte mit allen Touren; lädt die Linien erst dann. */
export function ToursMapButton() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FetchState>({ status: "idle" });

  async function load() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/tours/routes");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { routes: TourRoute[] };
      setState({
        status: "ready",
        routes: data.routes.map((t, idx) => ({
          activityId: t.id,
          name: t.name,
          routeData: [],
          segments: t.segments,
          color: TOUR_COLORS[idx % TOUR_COLORS.length],
          distance: t.distance,
          ascent: t.ascent,
          movingTime: t.movingTime,
          startTime: t.startTime,
          href: `/tours/${t.id}`,
          linkLabel: "Tour ansehen →",
        })),
      });
    } catch {
      setState({ status: "error" });
    }
  }

  function handleOpen() {
    setOpen(true);
    if (state.status === "idle" || state.status === "error") void load();
  }

  const meta =
    state.status === "ready"
      ? `${state.routes.length} ${state.routes.length === 1 ? "Tour" : "Touren"}`
      : undefined;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`${spaceMono.className} cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] transition-colors hover:border-[#4a4a4a] hover:text-white`}
      >
        <MapIcon className="h-3 w-3" />
        Karte
      </button>
      {open ? (
        <TourMapFullscreen meta={meta} onClose={() => setOpen(false)}>
          {state.status === "ready" && state.routes.length > 0 ? (
            <MultiRouteMapSection routes={state.routes} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-sm text-[#a3a3a3]">
              {state.status === "error" ? (
                <>
                  <p>Die Touren konnten nicht geladen werden.</p>
                  <button
                    type="button"
                    onClick={() => void load()}
                    className={`${spaceMono.className} cursor-pointer rounded-md border border-[#2a2a2a] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] transition-colors hover:border-[#4a4a4a] hover:text-white`}
                  >
                    Nochmals versuchen
                  </button>
                </>
              ) : state.status === "ready" ? (
                <p>Noch keine Tour mit Route-Daten.</p>
              ) : (
                <p>Karte wird geladen …</p>
              )}
            </div>
          )}
        </TourMapFullscreen>
      ) : null}
    </>
  );
}
