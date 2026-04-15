"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Camera, CameraOff } from "lucide-react";

const NEON = "#FF6A00";
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface PhotoMarker {
  id: string;
  lat: number;
  lng: number;
}

interface Props {
  routeData: { lat: number; lng: number; elevation?: number | null }[];
  photos?: PhotoMarker[];
  hoverIdx?: number | null;
  highlightRange?: [number, number] | null;
}

export default function BentoMapClient({
  routeData,
  photos = [],
  hoverIdx = null,
  highlightRange = null,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const hoverMarkerRef = useRef<L.CircleMarker | null>(null);
  const highlightLineRef = useRef<L.Polyline | null>(null);
  const photoMarkersRef = useRef<L.Marker[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPhotos, setShowPhotos] = useState(true);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (routeData.length === 0) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
      {
        maxZoom: 20,
        attribution: "© Mapbox © OpenStreetMap",
        tileSize: 512,
        zoomOffset: -1,
      }
    ).addTo(map);

    const positions: L.LatLngExpression[] = routeData.map((p) => [p.lat, p.lng]);

    // Outer glow polyline
    L.polyline(positions, {
      color: NEON,
      weight: 10,
      opacity: 0.25,
    }).addTo(map);
    // Main polyline
    const polyline = L.polyline(positions, {
      color: NEON,
      weight: 4,
      opacity: 0.95,
    }).addTo(map);

    L.circleMarker(positions[0] as L.LatLngExpression, {
      radius: 6,
      color: "#ffffff",
      weight: 2,
      fillColor: NEON,
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup("Start");

    L.circleMarker(positions[positions.length - 1] as L.LatLngExpression, {
      radius: 6,
      color: NEON,
      weight: 2,
      fillColor: "#ffffff",
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup("Ziel");

    map.fitBounds(polyline.getBounds(), { padding: [30, 30] });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [routeData]);

  // Photo markers
  useEffect(() => {
    if (!mapRef.current) return;
    for (const m of photoMarkersRef.current) m.remove();
    photoMarkersRef.current = [];
    if (!showPhotos) return;
    for (const photo of photos) {
      const icon = L.divIcon({
        html: `<img src="/api/photos/${photo.id}?thumb=1" alt="" class="photo-marker-img" style="border-color:${NEON}" />`,
        className: "photo-marker-wrapper",
        iconSize: [50, 50],
        iconAnchor: [25, 25],
      });
      const m = L.marker([photo.lat, photo.lng], { icon, zIndexOffset: 1000 })
        .addTo(mapRef.current)
        .on("click", () => {
          window.location.hash = `photo=${photo.id}`;
        });
      photoMarkersRef.current.push(m);
    }
  }, [photos, showPhotos]);

  // Highlight range polyline
  useEffect(() => {
    if (!mapRef.current) return;
    if (highlightLineRef.current) {
      highlightLineRef.current.remove();
      highlightLineRef.current = null;
    }
    if (!highlightRange) return;
    const [from, to] = highlightRange;
    if (from < 0 || to <= from || to >= routeData.length) return;
    const pts: L.LatLngExpression[] = [];
    for (let i = from; i <= to; i++) {
      pts.push([routeData[i].lat, routeData[i].lng]);
    }
    highlightLineRef.current = L.polyline(pts, {
      color: "#ffffff",
      weight: 7,
      opacity: 0.95,
    }).addTo(mapRef.current);
    try {
      mapRef.current.fitBounds(highlightLineRef.current.getBounds(), {
        padding: [40, 40],
        maxZoom: 16,
      });
    } catch {}
  }, [highlightRange, routeData]);

  // Hover marker
  useEffect(() => {
    if (!mapRef.current) return;
    if (hoverIdx == null || hoverIdx < 0 || hoverIdx >= routeData.length) {
      if (hoverMarkerRef.current) {
        hoverMarkerRef.current.remove();
        hoverMarkerRef.current = null;
      }
      return;
    }
    const p = routeData[hoverIdx];
    const pos: L.LatLngExpression = [p.lat, p.lng];
    if (!hoverMarkerRef.current) {
      hoverMarkerRef.current = L.circleMarker(pos, {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: NEON,
        fillOpacity: 1,
      }).addTo(mapRef.current);
    } else {
      hoverMarkerRef.current.setLatLng(pos);
    }
  }, [hoverIdx, routeData]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {photos.length > 0 && (
        <button
          type="button"
          onClick={() => setShowPhotos((v) => !v)}
          className={`absolute top-2 right-2 z-[1000] inline-flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-md border border-[#2a2a2a] [font-family:var(--bento-mono)] uppercase tracking-[0.12em] transition-colors ${
            showPhotos
              ? "bg-black text-white"
              : "bg-[#0f0f0f] text-[#6b6b6b] hover:text-white"
          }`}
          title={showPhotos ? "Fotos ausblenden" : "Fotos einblenden"}
        >
          {showPhotos ? <Camera className="h-3.5 w-3.5" /> : <CameraOff className="h-3.5 w-3.5" />}
          Fotos
        </button>
      )}
    </div>
  );
}
