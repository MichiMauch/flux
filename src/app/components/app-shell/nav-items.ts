import {
  Activity,
  BarChart3,
  Calendar,
  Heart,
  Home,
  Moon,
  Sun,
  Target,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavGroup = "primary" | "secondary";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  lottieFile?: string;
  group: NavGroup;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home, lottieFile: "home", group: "primary" },
  { href: "/stream", label: "Stream", icon: Users, lottieFile: "customer", group: "primary" },
  { href: "/activities", label: "Aktivitäten", icon: Activity, lottieFile: "activity-feed", group: "primary" },
  { href: "/calendar", label: "Kalender", icon: Calendar, lottieFile: "calendar", group: "primary" },
  { href: "/stats", label: "Statistiken", icon: BarChart3, lottieFile: "stats", group: "primary" },
  { href: "/training-load", label: "Form", icon: TrendingUp, lottieFile: "energy", group: "primary" },
  { href: "/daily", label: "Tag", icon: Sun, lottieFile: "daily", group: "secondary" },
  { href: "/goals", label: "Ziele", icon: Target, lottieFile: "goals", group: "secondary" },
  { href: "/trophies", label: "Trophäen", icon: Trophy, lottieFile: "trophy", group: "secondary" },
  { href: "/health", label: "Gesundheit", icon: Heart, lottieFile: "heartbeat", group: "secondary" },
  { href: "/sleep", label: "Schlaf", icon: Moon, lottieFile: "sleep", group: "secondary" },
];

export const PRIMARY_ITEMS = NAV_ITEMS.filter((i) => i.group === "primary");
export const SECONDARY_ITEMS = NAV_ITEMS.filter((i) => i.group === "secondary");

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function isSecondaryActive(pathname: string): boolean {
  return SECONDARY_ITEMS.some((i) => isActive(pathname, i.href));
}
