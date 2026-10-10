"use client";

import dynamic from "next/dynamic";
import type { MultiRouteEntry } from "./multi-route-map-client";

const MultiRouteMapClient = dynamic(() => import("./multi-route-map-client"), {
  ssr: false,
});

interface MultiRouteMapSectionProps {
  routes: MultiRouteEntry[];
  pageScroll?: boolean;
}

export function MultiRouteMapSection({
  routes,
  pageScroll,
}: MultiRouteMapSectionProps) {
  return <MultiRouteMapClient routes={routes} pageScroll={pageScroll} />;
}
