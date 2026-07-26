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
import type { MapRoute } from "@/app/api/map/routes/route";

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

/** px hit-test tolerance from click point to a route line */
const HIT_TOLERANCE = 12;
/** per-line alpha; overlaps accumulate under 'lighter' → density glow */
const LINE_ALPHA = 0.5;
const LINE_WEIGHT = 2;

function distToSegSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  const ex = px - qx;
  const ey = py - qy;
  return ex * ex + ey * ey;
}

/**
 * Custom Leaflet canvas overlay that draws every route with additive
 * ('lighter') blending, so frequently-travelled paths glow brighter. Layer
 * points are cached per zoom level; a pan only re-offsets + repaints (cheap),
 * a zoom reprojects. The canvas is pointer-events:none — clicks fall through
 * to the map and we hit-test in `nearest()` against the cached projection.
 */
class RouteGlowLayer {
  private map: L.Map;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private routes: MapRoute[] = [];
  private projected: L.Point[][] = [];
  private topLeft = L.point(0, 0);
  private selectedId: string | null = null;
  private rafId: number | null = null;

  constructor(map: L.Map) {
    this.map = map;
    const canvas = L.DomUtil.create(
      "canvas",
      "leaflet-zoom-hide",
    ) as HTMLCanvasElement;
    canvas.style.position = "absolute";
    canvas.style.pointerEvents = "none";
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    const pane = map.getPanes().overlayPane;
    if (pane) pane.appendChild(canvas);

    this.reset = this.reset.bind(this);
    this.onZoomEnd = this.onZoomEnd.bind(this);
    map.on("move", this.reset);
    map.on("moveend", this.reset);
    map.on("resize", this.reset);
    map.on("zoomend", this.onZoomEnd);
    this.reset();
  }

  destroy() {
    const map = this.map;
    map.off("move", this.reset);
    map.off("moveend", this.reset);
    map.off("resize", this.reset);
    map.off("zoomend", this.onZoomEnd);
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.canvas.remove();
  }

  setRoutes(routes: MapRoute[]) {
    this.routes = routes;
    this.project();
    this.scheduleRedraw();
  }

  setSelected(id: string | null) {
    this.selectedId = id;
    this.scheduleRedraw();
  }

  /** id of the route nearest to a container point, within HIT_TOLERANCE */
  nearest(containerPoint: L.Point): string | null {
    const tolSq = HIT_TOLERANCE * HIT_TOLERANCE;
    const tl = this.topLeft;
    let bestId: string | null = null;
    let bestSq = tolSq;
    for (let i = 0; i < this.routes.length; i++) {
      const pts = this.projected[i];
      if (!pts || pts.length < 2) continue;
      for (let j = 1; j < pts.length; j++) {
        const d = distToSegSq(
          containerPoint.x,
          containerPoint.y,
          pts[j - 1].x - tl.x,
          pts[j - 1].y - tl.y,
          pts[j].x - tl.x,
          pts[j].y - tl.y,
        );
        if (d < bestSq) {
          bestSq = d;
          bestId = this.routes[i].id;
        }
      }
    }
    return bestId;
  }

  private project() {
    const map = this.map;
    this.projected = this.routes.map((r) =>
      r.geometry.map((p) => map.latLngToLayerPoint([p.lat, p.lng])),
    );
  }

  private onZoomEnd() {
    this.project();
    this.reset();
  }

  private reset() {
    const map = this.map;
    const size = map.getSize();
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this.canvas, topLeft);
    if (this.canvas.width !== size.x) this.canvas.width = size.x;
    if (this.canvas.height !== size.y) this.canvas.height = size.y;
    this.topLeft = topLeft;
    this.scheduleRedraw();
  }

  private scheduleRedraw() {
    if (this.rafId != null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.redraw();
    });
  }

  private strokePath(pts: L.Point[]) {
    const ctx = this.ctx;
    const tl = this.topLeft;
    ctx.beginPath();
    for (let j = 0; j < pts.length; j++) {
      const x = pts[j].x - tl.x;
      const y = pts[j].y - tl.y;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private redraw() {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Pass 1: all non-selected routes, additive → density glow.
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = LINE_WEIGHT;
    ctx.globalAlpha = LINE_ALPHA;
    let selectedIdx = -1;
    for (let i = 0; i < this.routes.length; i++) {
      if (this.routes[i].id === this.selectedId) {
        selectedIdx = i;
        continue;
      }
      const pts = this.projected[i];
      if (!pts || pts.length < 2) continue;
      ctx.strokeStyle = sportColor(this.routes[i].type, i);
      this.strokePath(pts);
    }

    // Pass 2: selected route on top — white casing + solid colour.
    if (selectedIdx >= 0) {
      const pts = this.projected[selectedIdx];
      if (pts && pts.length >= 2) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 7;
        this.strokePath(pts);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = sportColor(
          this.routes[selectedIdx].type,
          selectedIdx,
        );
        ctx.lineWidth = 4;
        this.strokePath(pts);
      }
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}

function formatStartLabel(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface ActivityMapCanvasProps {
  routes: MapRoute[];
}

export default function ActivityMapCanvas({ routes }: ActivityMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const glowRef = useRef<RouteGlowLayer | null>(null);
  const didFitRef = useRef(false);
  const [layer, setLayer] = useState<LayerType>("outdoors");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Init map once.
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

    const glow = new RouteGlowLayer(map);
    glowRef.current = glow;

    map.on("click", (e: L.LeafletMouseEvent) => {
      const id = glow.nearest(e.containerPoint);
      setSelectedId(id);
      glow.setSelected(id);
    });

    return () => {
      glow.destroy();
      glowRef.current = null;
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Feed routes into the glow layer; fit bounds on first non-empty load only.
  useEffect(() => {
    const map = mapRef.current;
    const glow = glowRef.current;
    if (!map || !glow) return;

    glow.setRoutes(routes);

    if (!didFitRef.current && routes.length > 0) {
      const latlngs: L.LatLngExpression[] = [];
      for (const r of routes) {
        for (const p of r.geometry) latlngs.push([p.lat, p.lng]);
      }
      if (latlngs.length > 0) {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
        didFitRef.current = true;
      }
    }
  }, [routes]);

  // Swap tile layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current) return;
    map.removeLayer(tileLayerRef.current);
    const isMapbox = layer === "outdoors" || layer === "satellite";
    tileLayerRef.current = L.tileLayer(LAYERS[layer].url, {
      maxZoom: LAYERS[layer].maxZoom,
      attribution: LAYERS[layer].attribution,
      tileSize: isMapbox ? 512 : 256,
      zoomOffset: isMapbox ? -1 : 0,
    }).addTo(map);
  }, [layer]);

  const selectedRoute =
    selectedId != null ? routes.find((r) => r.id === selectedId) ?? null : null;
  const selectedIdx = selectedRoute ? routes.indexOf(selectedRoute) : -1;
  const selectedColor = selectedRoute
    ? sportColor(selectedRoute.type, selectedIdx)
    : null;
  const selectedDate = selectedRoute
    ? formatStartLabel(selectedRoute.startTime)
    : null;

  function clearSelection() {
    setSelectedId(null);
    glowRef.current?.setSelected(null);
  }

  return (
    <div className="relative h-full w-full isolate">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute top-2 right-2 z-[1000] flex rounded-md border bg-background shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setLayer("outdoors")}
          className={`flex cursor-pointer items-center gap-1 px-3 py-1.5 text-xs transition-colors ${
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
          className={`flex cursor-pointer items-center gap-1 px-3 py-1.5 text-xs transition-colors border-l ${
            layer === "cycle" ? "bg-foreground text-background" : "hover:bg-muted"
          }`}
          title="Velo-Karte"
        >
          <Bike className="h-3.5 w-3.5" />
          Velo
        </button>
        <button
          type="button"
          onClick={() => setLayer("satellite")}
          className={`flex cursor-pointer items-center gap-1 px-3 py-1.5 text-xs transition-colors border-l ${
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
              style={{ backgroundColor: selectedColor ?? "#ffffff" }}
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
              onClick={clearSelection}
              className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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
              href={`/activity/${selectedRoute.id}`}
              className="flex w-full cursor-pointer items-center justify-center rounded-md bg-foreground px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-background hover:opacity-90"
            >
              Details ansehen →
            </Link>
          </div>
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
