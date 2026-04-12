import FitParser from "fit-file-parser";

interface ParsedFitData {
  routeData: { lat: number; lng: number; time?: string; elevation?: number }[];
  heartRateData: { time: string; bpm: number }[];
  speedData: { time: string; speed: number }[];
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

        if (
          record.position_lat != null &&
          record.position_long != null
        ) {
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

      resolve({ routeData, heartRateData, speedData });
    });
  });
}
