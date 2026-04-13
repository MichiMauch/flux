"use client";

import dynamic from "next/dynamic";

const MapClient = dynamic(() => import("./map-client"), { ssr: false });

interface PhotoMarker {
  id: string;
  lat: number;
  lng: number;
}

interface MapSectionProps {
  routeData: { lat: number; lng: number; elevation?: number | null }[];
  photos?: PhotoMarker[];
  hoverIdx?: number | null;
  highlightRange?: [number, number] | null;
}

export function MapSection({ routeData, photos, hoverIdx, highlightRange }: MapSectionProps) {
  return (
    <MapClient
      routeData={routeData}
      photos={photos}
      hoverIdx={hoverIdx}
      highlightRange={highlightRange}
    />
  );
}
