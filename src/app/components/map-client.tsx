"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Mountain, Bike, Satellite } from "lucide-react";

interface PhotoMarker {
  id: string;
  lat: number;
  lng: number;
}

interface MapClientProps {
  routeData: { lat: number; lng: number; elevation?: number }[];
  photos?: PhotoMarker[];
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

export default function MapClient({ routeData, photos = [] }: MapClientProps) {
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [layer, setLayer] = useState<LayerType>("outdoors");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (routeData.length === 0) return;

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

    const positions: L.LatLngExpression[] = routeData.map((p) => [p.lat, p.lng]);

    const polyline = L.polyline(positions, {
      color: "#e11d48",
      weight: 4,
      opacity: 0.9,
    }).addTo(map);

    L.circleMarker(positions[0] as L.LatLngExpression, {
      radius: 6,
      color: "#16a34a",
      fillColor: "#16a34a",
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup("Start");

    L.circleMarker(positions[positions.length - 1] as L.LatLngExpression, {
      radius: 6,
      color: "#dc2626",
      fillColor: "#dc2626",
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup("Ziel");

    // Photo markers
    for (const photo of photos) {
      const icon = L.divIcon({
        html: `<img src="/api/photos/${photo.id}?thumb=1" alt="" class="photo-marker-img" />`,
        className: "photo-marker-wrapper",
        iconSize: [50, 50],
        iconAnchor: [25, 25],
      });
      L.marker([photo.lat, photo.lng], { icon, zIndexOffset: 1000 })
        .addTo(map)
        .on("click", () => {
          window.location.hash = `photo=${photo.id}`;
        });
    }

    map.fitBounds(polyline.getBounds(), { padding: [30, 30] });

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, [routeData, photos]);

  // Switch tile layer when toggle changes
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

      {/* Layer toggle */}
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
    </div>
  );
}
