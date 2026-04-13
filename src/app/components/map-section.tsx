"use client";

import dynamic from "next/dynamic";

const MapClient = dynamic(() => import("./map-client"), { ssr: false });

interface PhotoMarker {
  id: string;
  lat: number;
  lng: number;
}

interface MapSectionProps {
  routeData: { lat: number; lng: number; elevation?: number }[];
  photos?: PhotoMarker[];
}

export function MapSection({ routeData, photos }: MapSectionProps) {
  return <MapClient routeData={routeData} photos={photos} />;
}
