import FitParser from "fit-file-parser";

interface ParsedFitData {
  routeData: { lat: number; lng: number; time?: string; elevation?: number }[];
  heartRateData: { time: string; bpm: number }[];
  speedData: { time: string; speed: number }[];
  session: {
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
    sport?: string;
    subSport?: string;
  } | null;
}

export function parseFitFile(buffer: ArrayBuffer): Promise<ParsedFitData> {
  return new Promise((resolve, reject) => {
    const fitParser = new FitParser({
      force: true,
      speedUnit: "km/h",
      lengthUnit: "km",
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
      const session = s
        ? {
            avgCadence: s.avg_cadence ?? undefined,
            maxCadence: s.max_cadence ?? undefined,
            totalSteps: s.total_cycles ?? undefined,
            avgSpeed: s.avg_speed ?? undefined,
            maxSpeed: s.max_speed ?? undefined,
            avgHeartRate: s.avg_heart_rate ?? undefined,
            maxHeartRate: s.max_heart_rate ?? undefined,
            totalCalories: s.total_calories ?? undefined,
            totalAscent: s.total_ascent != null ? s.total_ascent * 1000 : undefined, // km → m
            totalDescent: s.total_descent != null ? s.total_descent * 1000 : undefined,
            totalDistance: s.total_distance != null ? s.total_distance * 1000 : undefined, // km → m
            totalElapsedTime: s.total_elapsed_time ?? undefined,
            sport: s.sport ?? undefined,
            subSport: s.sub_sport ?? undefined,
          }
        : null;

      resolve({ routeData, heartRateData, speedData, session });
    });
  });
}
