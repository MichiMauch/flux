import { Clock, Flame, Mountain, Ruler } from "lucide-react";
import { ActivityActionsMenu } from "@/app/components/activity-actions-menu";
import { rajdhani, spaceMono } from "@/app/components/bento/bento-fonts";
import { formatDurationHMS } from "@/lib/activity-format";
import { fmt } from "./helpers";
import { SevenSegTile, Tile } from "./tiles";

const TITLE_TEXT_SHADOW =
  "0 2px 8px rgba(0,0,0,0.45), 0 0 24px color-mix(in srgb, var(--activity-color, #FF6A00) 35%, transparent)";
const HERO_BG =
  "linear-gradient(135deg, color-mix(in srgb, var(--activity-color, #FF6A00) 28%, #0f0f0f) 0%, color-mix(in srgb, var(--activity-color, #FF6A00) 12%, #0f0f0f) 60%, #0f0f0f 100%)";
const HERO_BORDER =
  "color-mix(in srgb, var(--activity-color, #FF6A00) 45%, #2a2a2a)";

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
          className={`${spaceMono.className} [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] mb-2`}
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          Aktivität · {dateLabel}
        </div>
        <h1
          lang="de"
          className={`${rajdhani.className} font-bold uppercase leading-[0.95] tracking-[-0.01em] hyphens-auto break-words pr-10`}
          style={{
            fontSize: "clamp(36px, 8vw, 100px)",
            color: "#ffffff",
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

      <Tile>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <SevenSegTile
            icon={<Clock />}
            value={duration > 0 ? formatDurationHMS(duration) : "–"}
            label="Zeit"
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
      </Tile>
    </>
  );
}
