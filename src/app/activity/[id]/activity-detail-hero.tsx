import { Clock, Flame, Mountain, Ruler } from "lucide-react";
import { ActivityActionsMenu } from "@/app/components/activity-actions-menu";
import { rajdhani, spaceMono } from "@/app/components/bento/bento-fonts";
import { formatDurationHMS } from "@/lib/activity-format";
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
  };
  photoIds: { id: string }[];
  duration: number;
  totalDuration: number | null;
  distanceKm: string;
  ascent: number | null;
  calories: number | null;
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
  calories,
}: Props) {
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
        {isOwner && (
          <div className="absolute top-3 right-3">
            <ActivityActionsMenu
              activity={activity}
              initialPhotos={photoIds}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
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
