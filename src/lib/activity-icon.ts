import {
  Activity as ActivityIcon,
  Bike,
  Dumbbell,
  Footprints,
  Moon,
  MountainSnow,
  Snowflake,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function activityTypeIcon(type: string): LucideIcon {
  const t = type.toUpperCase();
  if (t.includes("RUN") || t.includes("JOG")) return Footprints;
  if (t.includes("WALK")) return Footprints;
  if (t.includes("HIK") || t.includes("TREK")) return MountainSnow;
  if (t.includes("CYCL") || t.includes("BIK") || t.includes("RIDE")) return Bike;
  if (t.includes("STRENGTH") || t.includes("CORE")) return Dumbbell;
  if (t.includes("SWIM")) return Waves;
  if (t.includes("SKI") || t.includes("SNOW")) return Snowflake;
  if (t.includes("SLEEP")) return Moon;
  return ActivityIcon;
}
