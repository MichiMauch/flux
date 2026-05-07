"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Mountain, Bike, Satellite, X } from "lucide-react";
import { sportColor } from "@/lib/sport-colors";
import {
  formatDistanceAuto,
  formatDurationWordsSpaced,
} from "@/lib/activity-format";

export interface MultiRouteEntry {
  activityId: string;
  name: string;
  routeData: { lat: number; lng: number }[];
  color?: string;
  type?: string;
  distance?: number | null;
  ascent?: number | null;
  movingTime?: number | null;
  startTime?: Date | string | null;
}

interface MultiRouteMapClientProps {
  routes: MultiRouteEntry[];
  showLegend?: boolean;
}

type LayerType = "outdoors" | "cycle" | "satellite";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const TF_KEY = process.env.NEXT_PUBLIC_THUNDERFOREST_KEY;

const LAYERS: Record<
  LayerType,
  { url: string; attribution: string; maxZoom: number }
> = {
  outdoors: {
    url: `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
    attribution: "© Mapbox © OpenStreetMap",
    maxZoom: 20,
  },
  cycle: {
    url: `https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=${TF_KEY}`,
    attribution: "© Thunderforest © OpenStreetMap",
    maxZoom: 22,
  },
  satellite: {
    url: `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
    attribution: "© Mapbox © OpenStreetMap",
    maxZoom: 20,
  },
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function colorFor(route: MultiRouteEntry, idx: number) {
  return route.color ?? sportColor(route.type ?? "", idx);
}

function formatStartLabel(start: MultiRouteEntry["startTime"]): string | null {
  if (!start) return null;
  const d = start instanceof Date ? start : new Date(start);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MultiRouteMapClient({
  routes,
  showLegend = true,
}: MultiRouteMapClientProps) {
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const baseColorsRef = useRef<Map<string, string>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<LayerType>("outdoors");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Treat selectedId as null when it points to a route that no longer exists
  const effectiveSelectedId =
    selectedId != null && routes.some((r) => r.activityId === selectedId)
      ? selectedId
      : null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    tileLayerRef.current = L.tileLayer(LAYERS.outdoors.url, {
      maxZoom: LAYERS.outdoors.maxZoom,
      attribution: LAYERS.outdoors.attribution,
      tileSize: 512,
      zoomOffset: -1,
    }).addTo(map);

    map.setView([46.8, 8.2], 7);

    map.on("click", () => setSelectedId(null));

    const polylinesMap = polylinesRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      polylinesMap.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const p of polylinesRef.current.values()) p.remove();
    polylinesRef.current.clear();
    baseColorsRef.current.clear();

    const allPositions: L.LatLngExpression[] = [];

    routes.forEach((route, idx) => {
      if (route.routeData.length < 2) return;
      const positions: L.LatLngExpression[] = route.routeData.map((p) => [
        p.lat,
        p.lng,
      ]);
      allPositions.push(...positions);

      const color = colorFor(route, idx);
      const polyline = L.polyline(positions, {
        color,
        weight: 4,
        opacity: 0.85,
        bubblingMouseEvents: false,
      }).addTo(map);

      polyline.bindTooltip(`<strong>${escapeHtml(route.name)}</strong>`, {
        sticky: true,
        direction: "top",
      });

      polyline.on("click", () => {
        setSelectedId((prev) =>
          prev === route.activityId ? null : route.activityId
        );
      });
      polyline.on("mouseover", () => setHoveredId(route.activityId));
      polyline.on("mouseout", () =>
        setHoveredId((prev) => (prev === route.activityId ? null : prev))
      );

      polylinesRef.current.set(route.activityId, polyline);
      baseColorsRef.current.set(route.activityId, color);
    });

    if (allPositions.length > 0) {
      const bounds = L.latLngBounds(allPositions);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [routes]);

  // Re-style polylines on selection change (auto-fit bounds to selection)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || effectiveSelectedId == null) return;
    const polyline = polylinesRef.current.get(effectiveSelectedId);
    if (!polyline) return;
    try {
      map.fitBounds(polyline.getBounds(), {
        padding: [50, 50],
        maxZoom: 15,
      });
    } catch {}
  }, [effectiveSelectedId]);

  // Re-style polylines on selection or hover change
  useEffect(() => {
    if (!mapRef.current) return;

    for (const [id, polyline] of polylinesRef.current.entries()) {
      const isSelected = id === effectiveSelectedId;
      const isHovered = id === hoveredId && !isSelected;
      const dimmed =
        effectiveSelectedId !== null && !isSelected && !isHovered;

      const baseColor = baseColorsRef.current.get(id) ?? "#ffffff";
      polyline.setStyle({
        color: isHovered ? "#ffffff" : baseColor,
        weight: isSelected ? 6 : isHovered ? 6 : dimmed ? 2 : 4,
        opacity: isSelected ? 1 : isHovered ? 1 : dimmed ? 0.35 : 0.85,
      });
      if (isSelected || isHovered) polyline.bringToFront();
    }
  }, [effectiveSelectedId, hoveredId]);

  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    mapRef.current.removeLayer(tileLayerRef.current);
    const isMapbox = layer === "outdoors" || layer === "satellite";
    tileLayerRef.current = L.tileLayer(LAYERS[layer].url, {
      maxZoom: LAYERS[layer].maxZoom,
      attribution: LAYERS[layer].attribution,
      tileSize: isMapbox ? 512 : 256,
      zoomOffset: isMapbox ? -1 : 0,
    }).addTo(mapRef.current);
  }, [layer]);

  const selectedRoute =
    effectiveSelectedId != null
      ? routes.find((r) => r.activityId === effectiveSelectedId) ?? null
      : null;
  const selectedIdx = selectedRoute ? routes.indexOf(selectedRoute) : -1;
  const selectedColor = selectedRoute
    ? colorFor(selectedRoute, selectedIdx)
    : null;
  const selectedDate = selectedRoute
    ? formatStartLabel(selectedRoute.startTime)
    : null;

  return (
    <div className="relative h-full w-full isolate">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute top-2 right-2 z-[1000] flex rounded-md border bg-background shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setLayer("outdoors")}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs transition-colors ${
            layer === "outdoors"
              ? "bg-foreground text-background"
              : "hover:bg-muted"
          }`}
          title="Outdoor / Wandern"
        >
          <Mountain className="h-3.5 w-3.5" />
          Outdoor
        </button>
        <button
          type="button"
          onClick={() => setLayer("cycle")}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs transition-colors border-l ${
            layer === "cycle"
              ? "bg-foreground text-background"
              : "hover:bg-muted"
          }`}
          title="Velo-Karte"
        >
          <Bike className="h-3.5 w-3.5" />
          Velo
        </button>
        <button
          type="button"
          onClick={() => setLayer("satellite")}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs transition-colors border-l ${
            layer === "satellite"
              ? "bg-foreground text-background"
              : "hover:bg-muted"
          }`}
          title="Satellit"
        >
          <Satellite className="h-3.5 w-3.5" />
          Satellit
        </button>
      </div>

      {selectedRoute && (
        <div className="absolute top-2 left-2 z-[1000] w-72 max-w-[calc(100%-1rem)] rounded-md border bg-background/95 shadow-md backdrop-blur">
          <div className="flex items-start gap-2 px-3 py-2">
            <span
              className="mt-1 h-3 w-1.5 shrink-0 rounded-sm"
              style={{
                backgroundColor: selectedColor ?? "#ffffff",
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-tight text-foreground">
                {selectedRoute.name}
              </div>
              {selectedDate ? (
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {selectedDate}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Auswahl aufheben"
              onClick={() => setSelectedId(null)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <dl className="grid grid-cols-3 gap-2 border-t px-3 py-2 text-center">
            <Stat
              label="Distanz"
              value={
                selectedRoute.distance != null
                  ? formatDistanceAuto(selectedRoute.distance, 1)
                  : "—"
              }
            />
            <Stat
              label="Höhenmeter"
              value={
                selectedRoute.ascent != null
                  ? `${Math.round(selectedRoute.ascent)} m`
                  : "—"
              }
            />
            <Stat
              label="Zeit"
              value={
                selectedRoute.movingTime != null
                  ? formatDurationWordsSpaced(selectedRoute.movingTime)
                  : "—"
              }
            />
          </dl>
          <div className="border-t p-2">
            <Link
              href={`/activity/${selectedRoute.activityId}`}
              className="flex w-full items-center justify-center rounded-md bg-foreground px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-background hover:opacity-90"
            >
              Details ansehen →
            </Link>
          </div>
        </div>
      )}

      {showLegend && routes.length > 0 && (
        <div className="absolute bottom-2 left-2 z-[1000] max-h-64 max-w-[60%] overflow-auto rounded-md border bg-background/95 backdrop-blur shadow-sm">
          {effectiveSelectedId != null && (
            <div className="sticky top-0 z-[1] border-b bg-background/95 backdrop-blur">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex w-full items-center justify-center gap-1 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Alle einblenden
              </button>
            </div>
          )}
          <ul className="divide-y">
            {routes.map((route, idx) => {
              const color = colorFor(route, idx);
              const isSelected = route.activityId === effectiveSelectedId;
              return (
                <li key={route.activityId}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedId((prev) =>
                        prev === route.activityId ? null : route.activityId
                      )
                    }
                    onMouseEnter={() => setHoveredId(route.activityId)}
                    onMouseLeave={() =>
                      setHoveredId((prev) =>
                        prev === route.activityId ? null : prev
                      )
                    }
                    onFocus={() => setHoveredId(route.activityId)}
                    onBlur={() =>
                      setHoveredId((prev) =>
                        prev === route.activityId ? null : prev
                      )
                    }
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-foreground text-background"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span
                      className="h-2.5 w-4 rounded-sm shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{route.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}
