"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  sampleAlongTrack,
  smoothedCenterAt,
  type FlightTrack,
  type FlightSample,
} from "@/lib/route-flight";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const BLEND_MS = 1200;

interface Props {
  track: FlightTrack;
  color: string;
  progress: number;
  /** Playback position for a given rAF timestamp (shared clock). */
  getProgress: (now: number) => number;
  playing: boolean;
  followCamera: boolean;
  isMobile: boolean;
  onSample?: (sample: FlightSample) => void;
  onMapError?: (err: Error) => void;
}

function shortestAngleDiff(from: number, to: number): number {
  return (((to - from) % 360) + 540) % 360 - 180;
}

function lerpAngle(from: number, to: number, alpha: number): number {
  const out = from + shortestAngleDiff(from, to) * alpha;
  return ((out % 360) + 360) % 360;
}

export default function FlightMapClient({
  track,
  color,
  progress,
  getProgress,
  playing,
  followCamera,
  isMobile,
  onSample,
  onMapError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const flyMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const onSampleRef = useRef(onSample);
  const styleLoadedRef = useRef(false);

  useEffect(() => {
    onSampleRef.current = onSample;
  }, [onSample]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!MAPBOX_TOKEN) {
      onMapError?.(new Error("Mapbox-Token fehlt"));
      return;
    }
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const [west, south, east, north] = track.bbox;
    const center: [number, number] = [(west + east) / 2, (south + north) / 2];
    const exaggeration = isMobile ? 1.2 : 1.5;
    const initialPitch = isMobile ? 50 : 65;

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        center,
        zoom: 12,
        pitch: initialPitch,
        bearing: -20,
        antialias: !isMobile,
      });
    } catch (err) {
      onMapError?.(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    mapRef.current = map;

    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );
    map.addControl(
      new mapboxgl.ScaleControl({ unit: "metric" }),
      "bottom-left",
    );

    const onError = (e: { error?: Error }) => {
      if (e.error) onMapError?.(e.error);
    };
    map.on("error", onError);

    map.on("load", () => {
      styleLoadedRef.current = true;
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: "mapbox-dem", exaggeration });

      if (!isMobile) {
        map.addLayer({
          id: "sky",
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0.0, 90.0],
            "sky-atmosphere-sun-intensity": 15,
          },
        });
      }

      const routeGeoJson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: track.points.map((p) => [
                p.lng,
                p.lat,
                p.elevation ?? 0,
              ]),
            },
          },
        ],
      };

      map.addSource("route", {
        type: "geojson",
        data: routeGeoJson,
      });

      const lineWidth = isMobile ? 4 : 5;
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": lineWidth + 3,
          "line-opacity": 0.7,
        },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": color,
          "line-width": lineWidth,
        },
      });

      const startEl = document.createElement("div");
      startEl.style.cssText =
        "width:14px;height:14px;border-radius:9999px;background:#10b981;box-shadow:0 0 0 2px #fff,0 4px 10px rgba(0,0,0,0.4);";
      new mapboxgl.Marker({ element: startEl })
        .setLngLat([track.points[0].lng, track.points[0].lat])
        .addTo(map);

      const lastPoint = track.points[track.points.length - 1];
      const endEl = document.createElement("div");
      endEl.style.cssText =
        "width:14px;height:14px;border-radius:9999px;background:#ef4444;box-shadow:0 0 0 2px #fff,0 4px 10px rgba(0,0,0,0.4);";
      new mapboxgl.Marker({ element: endEl })
        .setLngLat([lastPoint.lng, lastPoint.lat])
        .addTo(map);

      const flyEl = document.createElement("div");
      // Moving position puck: accent-independent white core with a dark ring
      // so it stays clearly visible on top of the (accent-coloured) route and
      // on any terrain — and is distinct from the green start / red end pins.
      flyEl.style.cssText =
        "width:16px;height:16px;border-radius:9999px;background:#ffffff;border:3px solid #0b0b0b;box-shadow:0 0 0 2px rgba(255,255,255,0.9),0 0 16px rgba(0,0,0,0.55);";
      const flySample = sampleAlongTrack(track, progress);
      flyMarkerRef.current = new mapboxgl.Marker({ element: flyEl })
        .setLngLat([flySample.lng, flySample.lat])
        .addTo(map);

      onSampleRef.current?.(flySample);

      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        {
          padding: 80,
          pitch: initialPitch,
          bearing: -20,
          duration: 1200,
        },
      );
    });

    return () => {
      map.off("error", onError);
      flyMarkerRef.current?.remove();
      flyMarkerRef.current = null;
      styleLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, isMobile]);

  // Paused / scrubbing: position the marker from the progress prop.
  useEffect(() => {
    if (playing) return;
    const marker = flyMarkerRef.current;
    if (!mapRef.current || !marker) return;
    const sample = sampleAlongTrack(track, progress, 80, 25);
    marker.setLngLat([sample.lng, sample.lat]);
    onSampleRef.current?.(sample);
  }, [progress, playing, track]);

  // Playing: own render loop, one camera update per display frame.
  useEffect(() => {
    if (!playing) return;
    const map = mapRef.current;
    if (!map) return;

    const pitch = isMobile ? 55 : 65;
    const zoom = 15;
    let raf: number | null = null;
    let lastNow: number | null = null;
    let lastSampleEmit = 0;
    let bearing: number | null = null;
    // Blend from wherever the camera is into the follow view.
    let blendFrom: {
      center: mapboxgl.LngLat;
      zoom: number;
      pitch: number;
      bearing: number;
    } | null = null;
    let blendStart: number | null = null;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const marker = flyMarkerRef.current;
      if (!marker) return;
      const dt = lastNow == null ? 0 : Math.min(0.1, (now - lastNow) / 1000);
      lastNow = now;

      const progressNow = getProgress(now);
      const sample = sampleAlongTrack(track, progressNow, 150, 50);
      marker.setLngLat([sample.lng, sample.lat]);
      if (now - lastSampleEmit >= 100) {
        lastSampleEmit = now;
        onSampleRef.current?.(sample);
      }

      if (!followCamera) return;

      // Frame-rate independent smoothing (time constant ~0.8 s).
      const alpha = 1 - Math.exp(-dt / 0.8);
      bearing =
        bearing === null
          ? sample.bearingDeg
          : lerpAngle(bearing, sample.bearingDeg, alpha);
      const center = smoothedCenterAt(track, sample.distanceM, 40);

      if (blendFrom === null) {
        blendFrom = {
          center: map.getCenter(),
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        };
        blendStart = now;
      }
      const t = Math.min(1, (now - (blendStart ?? now)) / BLEND_MS);
      if (t < 1) {
        const e = t * t * (3 - 2 * t);
        map.jumpTo({
          center: [
            blendFrom.center.lng + (center[0] - blendFrom.center.lng) * e,
            blendFrom.center.lat + (center[1] - blendFrom.center.lat) * e,
          ],
          zoom: blendFrom.zoom + (zoom - blendFrom.zoom) * e,
          pitch: blendFrom.pitch + (pitch - blendFrom.pitch) * e,
          bearing: lerpAngle(blendFrom.bearing, bearing, e),
        });
        return;
      }
      map.jumpTo({ center, bearing, pitch, zoom });
    };
    raf = requestAnimationFrame(frame);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [playing, followCamera, track, isMobile, getProgress]);

  return <div ref={containerRef} className="h-full w-full" />;
}
