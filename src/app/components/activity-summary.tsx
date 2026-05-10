import { Heart } from "lucide-react";
import { ActivityActionsMenu } from "./activity-actions-menu";
import { HrZonesChart } from "./hr-zones-chart";
import { ActivityLottie } from "./activity-lottie";
import type { WeatherData } from "@/lib/weather";
import { activityTypeLabel } from "@/lib/activity-types";
import type { HrSample } from "@/lib/hr-zones";
import {
  formatDistanceValue,
  formatDurationHMS,
} from "@/lib/activity-format";
import { AccordionSection } from "./activity-summary/accordion-section";
import { SummaryLeftPanel } from "./activity-summary/left-panel";
import { HeroStat } from "./activity-summary/metric-atoms";
import { SummaryMetricsGrid } from "./activity-summary/metrics-grid";
import { TrimpValues } from "./activity-summary/trimp-values";
import { WeatherRow } from "./activity-summary/weather-row";

interface Photo {
  id: string;
  location: string | null;
}

interface ActivitySummaryProps {
  activity: {
    id: string;
    name: string;
    type: string;
    startTime: Date;
    duration: number | null;
    movingTime: number | null;
    distance: number | null;
    calories: number | null;
    avgHeartRate: number | null;
    maxHeartRate: number | null;
    ascent: number | null;
    descent: number | null;
    avgCadence: number | null;
    totalSteps: number | null;
    avgSpeed: number | null;
    cardioLoad: number | null;
    muscleLoad: number | null;
    runningIndex: number | null;
    trimp: number | null;
    fatPercentage: number | null;
    carbPercentage: number | null;
    proteinPercentage: number | null;
    device: string | null;
    notes: string | null;
  };
  userName: string | null;
  photos: Photo[];
  weather: WeatherData | null;
  isOwner: boolean;
  heartRateData?: HrSample[];
  userProfile?: {
    sex?: "male" | "female" | null;
    birthday?: Date | string | null;
    maxHeartRate?: number | null;
    restHeartRate?: number | null;
    aerobicThreshold?: number | null;
    anaerobicThreshold?: number | null;
  };
}

function formatDuration(seconds: number | null): string {
  return seconds ? formatDurationHMS(seconds) : "–";
}

function formatDistance(meters: number | null): string {
  return meters == null ? "–" : formatDistanceValue(meters, 2);
}

export function ActivitySummary({
  activity,
  photos,
  weather,
  isOwner,
  heartRateData,
  userProfile,
}: ActivitySummaryProps) {
  const locationLabel = photos.find((p) => p.location)?.location ?? null;
  const hasLeftContent = photos.length > 0 || !!activity.notes;

  const dateLabel = activity.startTime.toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeLabel = activity.startTime.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <div className="rounded-t-lg border border-border bg-surface/60 px-4 py-3 flex items-center gap-3">
        <div className="flex-shrink-0">
          <ActivityLottie
            activityType={activity.type}
            activityName={activity.name}
            size={56}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1 flex-wrap">
            <span>
              {activityTypeLabel(activity.type)} · {dateLabel} · {timeLabel}
              {locationLabel ? ` · ${locationLabel}` : ""}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-[-0.03em] leading-tight truncate">
            {activity.name}
          </h1>
        </div>
        {isOwner && (
          <ActivityActionsMenu
            activity={{
              id: activity.id,
              name: activity.name,
              type: activity.type,
              notes: activity.notes,
              ascent: activity.ascent,
              descent: activity.descent,
            }}
            initialPhotos={photos.map((p) => ({ id: p.id }))}
          />
        )}
      </div>

      <div className="rounded-b-lg border-x border-b border-border bg-background overflow-hidden -mt-px">
        <div
          className={
            hasLeftContent
              ? "grid md:grid-cols-[minmax(280px,0.8fr)_1px_1.2fr]"
              : "grid"
          }
        >
          {hasLeftContent && (
            <>
              <SummaryLeftPanel
                notes={activity.notes}
                photos={photos}
                weather={weather}
              />
              <div className="hidden md:block bg-border" />
            </>
          )}

          <div className="flex flex-col">
            <div className="grid grid-cols-3 px-4 pt-4 pb-3 border-b border-border">
              <HeroStat
                value={formatDuration(activity.movingTime ?? activity.duration)}
                unit=""
                label="Bewegungszeit"
              />
              <HeroStat
                value={formatDistance(activity.distance)}
                unit={
                  activity.distance != null && activity.distance >= 1000
                    ? "km"
                    : "m"
                }
                label="Distanz"
                withDivider
              />
              <HeroStat
                value={
                  activity.ascent != null ? `${Math.round(activity.ascent)}` : "–"
                }
                unit={activity.ascent != null ? "m" : ""}
                label="Aufstieg"
                withDivider
              />
            </div>

            <SummaryMetricsGrid
              activity={activity}
              formatDuration={formatDuration}
            />

            {activity.trimp != null && activity.trimp > 0 && (
              <TrimpValues
                trimp={activity.trimp}
                durationSec={activity.movingTime ?? activity.duration}
              />
            )}

            {heartRateData && heartRateData.length > 1 && userProfile && (
              <AccordionSection
                title="Herzfrequenz-Zonen"
                icon={<Heart className="h-3 w-3" />}
                defaultOpen
              >
                <HrZonesChart samples={heartRateData} user={userProfile} />
              </AccordionSection>
            )}

            {!hasLeftContent && weather && (
              <div className="px-4 py-3 border-t border-border">
                <WeatherRow
                  weather={weather}
                  columns="grid-cols-2 sm:grid-cols-4"
                />
              </div>
            )}

            {activity.device && (
              <div className="px-4 py-1.5 text-[10px] text-muted-foreground font-mono flex gap-2 flex-wrap border-t border-border">
                <span>{activity.device}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
