"use client";

import dynamic from "next/dynamic";
import type { MultiRouteEntry } from "./multi-route-map-client";

const MultiRouteMapClient = dynamic(() => import("./multi-route-map-client"), {
  ssr: false,
});

interface MultiRouteMapSectionProps {
  routes: MultiRouteEntry[];
  showLegend?: boolean;
}

export function MultiRouteMapSection({
  routes,
  showLegend,
}: MultiRouteMapSectionProps) {
  return <MultiRouteMapClient routes={routes} showLegend={showLegend} />;
}
