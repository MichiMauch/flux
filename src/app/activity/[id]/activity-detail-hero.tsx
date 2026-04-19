import { Clock, Flame, Mountain, Ruler } from "lucide-react";
import { ActivityActionsMenu } from "@/app/components/activity-actions-menu";
import { rajdhani } from "@/app/components/bento/bento-fonts";
import { formatDurationHMS } from "@/lib/activity-format";
import { fmt } from "./helpers";
import { SevenSegTile, Tile, TileLabel } from "./tiles";

const NEON = "var(--activity-color, #FF6A00)";
const NEON_ALPHA_66 =
  "color-mix(in srgb, var(--activity-color, #FF6A00) 40%, transparent)";
const NEON_ALPHA_33 =
  "color-mix(in srgb, var(--activity-color, #FF6A00) 20%, transparent)";

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
      <Tile className="relative overflow-hidden">
        <TileLabel>Aktivität · {dateLabel}</TileLabel>
        <h1
          className={`${rajdhani.className} font-bold uppercase leading-[0.95] tracking-[-0.01em] break-words pr-10`}
          style={{
            fontSize: "clamp(48px, 8vw, 100px)",
            color: NEON,
            textShadow: `0 0 18px ${NEON_ALPHA_66}, 0 0 36px ${NEON_ALPHA_33}`,
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
      </Tile>

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
