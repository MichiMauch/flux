import {
  Activity,
  Clock,
  Flame,
  Footprints,
  Gauge,
  Heart,
  Mountain,
} from "lucide-react";
import { formatPace } from "@/lib/activity-format";
import { MacroTile, Mini } from "./metric-atoms";

interface Props {
  activity: {
    type: string;
    distance: number | null;
    duration: number | null;
    descent: number | null;
    avgHeartRate: number | null;
    maxHeartRate: number | null;
    avgCadence: number | null;
    totalSteps: number | null;
    calories: number | null;
    cardioLoad: number | null;
    fatPercentage: number | null;
    carbPercentage: number | null;
    proteinPercentage: number | null;
  };
  formatDuration: (sec: number | null) => string;
}

export function SummaryMetricsGrid({ activity, formatDuration }: Props) {
  const isRunning = activity.type.toUpperCase() === "RUNNING";
  const hasMacros = activity.fatPercentage != null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 border-b border-border">
      {activity.descent != null && activity.descent > 0 && (
        <Mini
          icon={<Mountain />}
          label="Abstieg"
          value={`${Math.round(activity.descent)}`}
          unit="m"
        />
      )}
      {activity.distance != null && activity.duration != null && (
        <Mini
          icon={isRunning ? <Footprints /> : <Gauge />}
          label={isRunning ? "Pace" : "Ø Speed"}
          value={
            isRunning
              ? formatPace(activity.distance, activity.duration)
              : ((activity.distance / 1000) / (activity.duration / 3600)).toFixed(1)
          }
          unit={isRunning ? "/km" : "km/h"}
        />
      )}
      {activity.maxHeartRate != null && (
        <Mini
          icon={<Heart />}
          label="Max Puls"
          value={`${activity.maxHeartRate}`}
          unit="bpm"
        />
      )}
      {activity.avgHeartRate != null && (
        <Mini
          icon={<Heart />}
          label="Ø Puls"
          value={`${activity.avgHeartRate}`}
          unit="bpm"
        />
      )}
      {activity.avgCadence != null && (
        <Mini
          icon={<Footprints />}
          label="Kadenz"
          value={`${activity.avgCadence}`}
          unit="spm"
        />
      )}
      {activity.totalSteps != null && activity.totalSteps > 0 && (
        <Mini
          icon={<Footprints />}
          label="Schritte"
          value={activity.totalSteps.toLocaleString("de-CH")}
          unit=""
        />
      )}
      {activity.calories != null && (
        <Mini
          icon={<Flame />}
          label="Kalorien"
          value={`${activity.calories}`}
          unit="kcal"
        />
      )}
      {activity.duration != null && (
        <Mini
          icon={<Clock />}
          label="Gesamtzeit"
          value={formatDuration(activity.duration)}
          unit=""
        />
      )}
      {activity.cardioLoad != null && activity.cardioLoad > 0 && (
        <Mini
          icon={<Activity />}
          label="Cardio Load"
          value={activity.cardioLoad.toFixed(0)}
          unit=""
        />
      )}
      {hasMacros && (
        <MacroTile
          carb={activity.carbPercentage ?? 0}
          fat={activity.fatPercentage ?? 0}
          protein={activity.proteinPercentage ?? 0}
        />
      )}
    </div>
  );
}
