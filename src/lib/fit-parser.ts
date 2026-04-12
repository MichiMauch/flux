import FitParser from "fit-file-parser";

interface ParsedFitData {
  routeData: { lat: number; lng: number; time?: string; elevation?: number }[];
  heartRateData: { time: string; bpm: number }[];
  speedData: { time: string; speed: number }[];
  session: {
    minAltitude?: number;
    maxAltitude?: number;
    avgTemperature?: number;
    minTemperature?: number;
    maxTemperature?: number;
    avgCadence?: number;
    maxCadence?: number;
    totalSteps?: number;
    avgSpeed?: number;
    maxSpeed?: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    totalCalories?: number;
    totalAscent?: number;
    totalDescent?: number;
    totalDistance?: number;
    totalElapsedTime?: number;
    totalTimerTime?: number;
    sport?: string;
    subSport?: string;
  } | null;
}

export function parseFitFile(buffer: ArrayBuffer): Promise<ParsedFitData> {
  return new Promise((resolve, reject) => {
    const fitParser = new FitParser({
      force: true,
      speedUnit: "km/h",
      lengthUnit: "m",
      elapsedRecordField: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fitParser.parse(Buffer.from(buffer), (error: unknown, data: any) => {
      if (error || !data) {
        reject(error ?? new Error("No data from FIT parser"));
        return;
      }

      const routeData: ParsedFitData["routeData"] = [];
      const heartRateData: ParsedFitData["heartRateData"] = [];
      const speedData: ParsedFitData["speedData"] = [];

      for (const record of data.records ?? []) {
        const time = record.timestamp
          ? new Date(record.timestamp).toISOString()
          : undefined;

        if (record.position_lat != null && record.position_long != null) {
          routeData.push({
            lat: record.position_lat,
            lng: record.position_long,
            time,
            elevation: record.altitude,
          });
        }

        if (record.heart_rate != null && time) {
          heartRateData.push({ time, bpm: record.heart_rate });
        }

        if (time) {
          const speed = record.enhanced_speed ?? record.speed;
          if (speed != null) {
            speedData.push({ time, speed });
          }
        }
      }

      // Extract session-level data
      const s = data.sessions?.[0];
      // Calculate altitude stats from records (FIT uses km for altitude with lengthUnit: km)
      const alts = (data.records ?? [])
        .map((r: any) => r.altitude)
        .filter((a: any) => a != null) as number[];
      const minAlt = alts.length > 0 ? Math.round(Math.min(...alts)) : undefined;
      const maxAlt = alts.length > 0 ? Math.round(Math.max(...alts)) : undefined;

      // Calculate temperature stats from records
      const temps = (data.records ?? [])
        .map((r: any) => r.temperature)
        .filter((t: any) => t != null) as number[];
      const avgTemp = temps.length > 0 ? temps.reduce((a: number, b: number) => a + b, 0) / temps.length : undefined;
      const minTemp = temps.length > 0 ? Math.min(...temps) : undefined;
      const maxTemp = temps.length > 0 ? Math.max(...temps) : undefined;

      const session = s
        ? {
            minAltitude: minAlt,
            maxAltitude: maxAlt,
            avgTemperature: avgTemp,
            minTemperature: minTemp,
            maxTemperature: maxTemp,
            avgCadence: s.avg_cadence ?? undefined,
            maxCadence: s.max_cadence ?? undefined,
            totalSteps: s.total_cycles ?? undefined,
            avgSpeed: s.avg_speed ?? undefined,
            maxSpeed: s.max_speed ?? undefined,
            avgHeartRate: s.avg_heart_rate ?? undefined,
            maxHeartRate: s.max_heart_rate ?? undefined,
            totalCalories: s.total_calories ?? undefined,
            totalAscent: s.total_ascent ?? undefined,
            totalDescent: s.total_descent ?? undefined,
            totalDistance: s.total_distance ?? undefined,
            totalElapsedTime: s.total_elapsed_time ?? undefined,
            totalTimerTime: s.total_timer_time ?? undefined,
            sport: s.sport ?? undefined,
            subSport: s.sub_sport ?? undefined,
          }
        : null;

      resolve({ routeData, heartRateData, speedData, session });
    });
  });
}
