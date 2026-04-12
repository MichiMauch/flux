"use client";

import dynamic from "next/dynamic";

const MapClient = dynamic(() => import("./map-client"), { ssr: false });

interface MapSectionProps {
  routeData: { lat: number; lng: number; elevation?: number }[];
}

export function MapSection({ routeData }: MapSectionProps) {
  return <MapClient routeData={routeData} />;
}
