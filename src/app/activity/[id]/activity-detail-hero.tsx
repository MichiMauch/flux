import { Clock, Flame, Heart, Mountain, Ruler } from "lucide-react";
import { ActivityActionsMenu } from "@/app/components/activity-actions-menu";
import { BoostButton, type Booster } from "@/app/components/boost-button";
import { rajdhani, spaceMono } from "@/app/components/bento/bento-fonts";
import { PersonalBestLine } from "@/app/components/personal-best-line";
import { showsTerrain } from "@/lib/activity-types";
import { formatDurationHMS } from "@/lib/activity-format";
import type { PrBadge } from "@/lib/personal-bests";
import { activitySourceLabel } from "@/lib/activity-types";
import { fmt } from "./helpers";
import { SevenSegTile } from "./tiles";

const NEON = "var(--activity-color, #FF6A00)";
const TITLE_TEXT_SHADOW =
  "0 2px 6px rgba(0,0,0,0.55), 0 0 18px color-mix(in srgb, var(--activity-color, #FF6A00) 55%, transparent), 0 0 36px color-mix(in srgb, var(--activity-color, #FF6A00) 30%, transparent)";
const HERO_BG =
  "linear-gradient(135deg, #0f0f0f 0%, color-mix(in srgb, var(--activity-color, #FF6A00) 10%, #0f0f0f) 45%, color-mix(in srgb, var(--activity-color, #FF6A00) 22%, #0f0f0f) 100%)";
const HERO_BORDER =
  "color-mix(in srgb, var(--activity-color, #FF6A00) 40%, #2a2a2a)";

interface Props {
  dateLabel: string;
  name: string;
  isOwner: boolean;
  activity: {
    id: string;
    name: string;
    type: string;
    notes: string | null;
    ascent: number | null;
    descent: number | null;
    source: string;
    device: string | null;
  };
  photoIds: { id: string }[];
  duration: number;
  totalDuration: number | null;
  distanceKm: string;
  ascent: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  boostable: boolean;
  boostedByMe: boolean;
  boosters: Booster[];
  color: string;
  personalBests?: PrBadge[];
}

export function ActivityDetailHero({
  dateLabel,
  name,
  isOwner,
  activity,
  photoIds,
  duration,
  totalDuration,
  distanceKm,
  ascent,
  avgHr,
  maxHr,
  calories,
  boostable,
  boostedByMe,
  boosters,
  color,
  personalBests,
}: Props) {
  const showBoost = boostable || boosters.length > 0;
  // Yoga und Krafttraining kennen weder Distanz noch Aufstieg. Statt zwei
  // Kacheln mit "0.00 km" und "– m" stehen dort die beiden Pulswerte, die
  // sonst weiter unten im Raster sitzen — sie sind bei diesen Sportarten das
  // Einzige, woran man die Belastung ablesen kann.
  const terrain = showsTerrain(activity.type);
  // Woher die Daten kommen. Bei zwei Uhren nebeneinander ist das keine
  // Nebensaechlichkeit — man will sehen, welche eine Aktivitaet aufgezeichnet hat.
  const sourceLabel = activitySourceLabel(activity.source, activity.device);

  return (
    <>
      <div
        className="relative overflow-hidden rounded-xl border p-4"
        style={{
          background: HERO_BG,
          borderColor: HERO_BORDER,
        }}
      >
        <div
          className={`${spaceMono.className} [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3] mb-2`}
        >
          Aktivität · {dateLabel}
          {sourceLabel ? ` · ${sourceLabel}` : ""}
        </div>
        <h1
          lang="de"
          className={`${rajdhani.className} font-bold uppercase leading-[0.95] tracking-[-0.01em] hyphens-auto break-words pr-10`}
          style={{
            fontSize: "clamp(36px, 8vw, 100px)",
            color: NEON,
            textShadow: TITLE_TEXT_SHADOW,
          }}
        >
          {name}
        </h1>
        {personalBests && personalBests.length > 0 && (
          <PersonalBestLine items={personalBests} />
        )}
        {isOwner && (
          <div className="absolute top-3 right-3">
            <ActivityActionsMenu
              activity={activity}
              initialPhotos={photoIds}
            />
          </div>
        )}
        {showBoost && (
          <div className="mt-3">
            <BoostButton
              activityId={activity.id}
              initialBoosted={boostedByMe}
              initialBoosters={boosters}
              canBoost={boostable}
              color={color}
            />
          </div>
        )}
      </div>

      <div
        className="relative overflow-hidden rounded-xl border p-4"
        style={{
          background: HERO_BG,
          borderColor: HERO_BORDER,
        }}
      >
        <div className="grid grid-cols-2 gap-4 items-start md:grid-cols-4">
          <SevenSegTile
            icon={<Clock />}
            value={duration > 0 ? formatDurationHMS(duration) : "–"}
            label="Zeit"
            sub={
              totalDuration != null && totalDuration > duration
                ? `↳ Gesamt ${formatDurationHMS(totalDuration)}`
                : undefined
            }
          />
          {terrain ? (
            <>
              <SevenSegTile
                icon={<Ruler />}
                value={distanceKm}
                suffix="km"
                label="Distanz"
              />
              <SevenSegTile
                icon={<Mountain />}
                value={fmt(ascent)}
                suffix="m"
                label="Aufstieg"
              />
            </>
          ) : (
            <>
              <SevenSegTile
                icon={<Heart />}
                value={fmt(avgHr)}
                suffix="bpm"
                label="Ø Puls"
              />
              <SevenSegTile
                icon={<Heart />}
                value={fmt(maxHr)}
                suffix="bpm"
                label="Max Puls"
              />
            </>
          )}
          <SevenSegTile
            icon={<Flame />}
            value={fmt(calories)}
            suffix="kcal"
            label="Kalorien"
          />
        </div>
      </div>
    </>
  );
}
