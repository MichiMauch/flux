import {
  Bike,
  Footprints,
  Medal,
  Mountain,
  Clock,
  Sunrise,
  Moon,
  Route,
  TrendingUp,
  Activity,
  Hourglass,
  Flame,
  Sun,
  Trophy,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Bike,
  Footprints,
  Medal,
  Mountain,
  Clock,
  Sunrise,
  Moon,
  Route,
  TrendingUp,
  Activity,
  Hourglass,
  Flame,
  Sun,
  Trophy,
};

export function TrophyIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Trophy;
  return <Icon className={className} />;
}
