"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Mountain, Bike, Satellite } from "lucide-react";
import { sportColor } from "@/lib/sport-colors";

export interface MultiRouteEntry {
  activityId: string;
  name: string;
  routeData: { lat: number; lng: number }[];
  color?: string;
  type?: string;
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

export default function MultiRouteMapClient({
  routes,
  showLegend = true,
}: MultiRouteMapClientProps) {
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<LayerType>("outdoors");

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

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      polylinesRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const p of polylinesRef.current) p.remove();
    polylinesRef.current = [];

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
      }).addTo(map);

      polyline.bindTooltip(`<strong>${escapeHtml(route.name)}</strong>`, {
        sticky: true,
        direction: "top",
      });

      polyline.on("click", () => {
        window.location.href = `/activity/${route.activityId}`;
      });
      polyline.on("mouseover", () => polyline.setStyle({ weight: 6 }));
      polyline.on("mouseout", () => polyline.setStyle({ weight: 4 }));

      polylinesRef.current.push(polyline);
    });

    if (allPositions.length > 0) {
      const bounds = L.latLngBounds(allPositions);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [routes]);

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

  return (
    <div className="relative h-full w-full">
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

      {showLegend && routes.length > 0 && (
        <div className="absolute bottom-2 left-2 z-[1000] max-h-64 max-w-[60%] overflow-auto rounded-md border bg-background/95 backdrop-blur shadow-sm">
          <ul className="divide-y">
            {routes.map((route, idx) => {
              const color = colorFor(route, idx);
              return (
                <li key={route.activityId}>
                  <Link
                    href={`/activity/${route.activityId}`}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    <span
                      className="h-2.5 w-4 rounded-sm shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{route.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
