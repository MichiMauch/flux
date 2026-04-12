"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapClientProps {
  routeData: { lat: number; lng: number; elevation?: number }[];
}

export default function MapClient({ routeData }: MapClientProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (routeData.length === 0) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const positions: L.LatLngExpression[] = routeData.map((p) => [p.lat, p.lng]);

    // Route polyline
    const polyline = L.polyline(positions, {
      color: "#e11d48",
      weight: 4,
      opacity: 0.9,
    }).addTo(map);

    // Start marker
    L.circleMarker(positions[0] as L.LatLngExpression, {
      radius: 6,
      color: "#16a34a",
      fillColor: "#16a34a",
      fillOpacity: 1,
    }).addTo(map).bindPopup("Start");

    // End marker
    L.circleMarker(positions[positions.length - 1] as L.LatLngExpression, {
      radius: 6,
      color: "#dc2626",
      fillColor: "#dc2626",
      fillOpacity: 1,
    }).addTo(map).bindPopup("Ziel");

    map.fitBounds(polyline.getBounds(), { padding: [30, 30] });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [routeData]);

  return <div ref={containerRef} className="h-full w-full" />;
}
