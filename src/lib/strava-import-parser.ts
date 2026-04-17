/**
 * Maps a Strava activity + its streams into the flux activities-row shape.
 *
 * The shape matches `polar-export-parser.ParsedTraining` so downstream code
 * in scripts/import-strava.ts can reuse the same insert pattern.
 */

import type { StravaActivity, StravaStreams } from "./strava-client";
import { stravaSportToType } from "./strava-sport-map";

export interface ParsedStravaActivity {
  polarId: string; // "strava:<id>" for lineage + unique constraint
  stravaId: number;
  startTime: Date;
  durationSec: number;
  movingTimeSec: number;
  distanceMeters: number | null;
  calories: number | null;
  ascent: number | null;
  descent: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  type: string;
  sportTypeRaw: string;
  device: string | null;
  avgSpeed: number | null;
  maxSpeed: number | null;
  minAltitude: number | null;
  maxAltitude: number | null;
  routeData: { lat: number; lng: number; time: string; elevation?: number }[] | null;
  heartRateData: { time: string; bpm: number }[] | null;
  speedData: { time: string; speed: number }[] | null;
  rawName: string;
}

export function parseStravaActivity(
  activity: StravaActivity,
  streams: StravaStreams | null
): ParsedStravaActivity {
  const startTime = new Date(activity.start_date); // UTC

  const latlng = streams?.latlng?.data ?? [];
  const timeSec = streams?.time?.data ?? [];
  const hrArr = streams?.heartrate?.data ?? [];
  const velArr = streams?.velocity_smooth?.data ?? [];
  const altArr = streams?.altitude?.data ?? [];

  const startMs = startTime.getTime();

  const routeData: ParsedStravaActivity["routeData"] = [];
  for (let i = 0; i < latlng.length; i++) {
    const point = latlng[i];
    if (!Array.isArray(point) || point.length < 2) continue;
    const [lat, lng] = point;
    const tSec = typeof timeSec[i] === "number" ? timeSec[i] : i;
    routeData.push({
      lat,
      lng,
      time: new Date(startMs + tSec * 1000).toISOString(),
      elevation: typeof altArr[i] === "number" ? altArr[i] : undefined,
    });
  }

  const heartRateData: ParsedStravaActivity["heartRateData"] = [];
  for (let i = 0; i < hrArr.length; i++) {
    const bpm = hrArr[i];
    if (!Number.isFinite(bpm) || bpm <= 0) continue;
    const tSec = typeof timeSec[i] === "number" ? timeSec[i] : i;
    heartRateData.push({
      time: new Date(startMs + tSec * 1000).toISOString(),
      bpm: Math.round(bpm),
    });
  }

  const speedData: ParsedStravaActivity["speedData"] = [];
  for (let i = 0; i < velArr.length; i++) {
    const v = velArr[i];
    if (!Number.isFinite(v)) continue;
    const tSec = typeof timeSec[i] === "number" ? timeSec[i] : i;
    speedData.push({
      time: new Date(startMs + tSec * 1000).toISOString(),
      speed: v,
    });
  }

  return {
    polarId: `strava:${activity.id}`,
    stravaId: activity.id,
    startTime,
    durationSec: Math.round(activity.elapsed_time ?? 0),
    movingTimeSec: Math.round(activity.moving_time ?? 0),
    distanceMeters: typeof activity.distance === "number" ? activity.distance : null,
    calories: typeof activity.calories === "number" ? Math.round(activity.calories) : null,
    ascent:
      typeof activity.total_elevation_gain === "number"
        ? activity.total_elevation_gain
        : null,
    descent: null, // Strava does not expose descent directly
    hrAvg:
      typeof activity.average_heartrate === "number"
        ? Math.round(activity.average_heartrate)
        : null,
    hrMax:
      typeof activity.max_heartrate === "number"
        ? Math.round(activity.max_heartrate)
        : null,
    type: stravaSportToType(activity.sport_type),
    sportTypeRaw: activity.sport_type,
    device: activity.device_name ?? "Strava",
    avgSpeed:
      typeof activity.average_speed === "number" ? activity.average_speed : null,
    maxSpeed: typeof activity.max_speed === "number" ? activity.max_speed : null,
    minAltitude: typeof activity.elev_low === "number" ? Math.round(activity.elev_low) : null,
    maxAltitude: typeof activity.elev_high === "number" ? Math.round(activity.elev_high) : null,
    routeData: routeData.length > 0 ? routeData : null,
    heartRateData: heartRateData.length > 0 ? heartRateData : null,
    speedData: speedData.length > 0 ? speedData : null,
    rawName: activity.name ?? "",
  };
}
