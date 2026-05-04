import {
  Activity,
  BarChart3,
  Calendar,
  Heart,
  Home,
  Layers,
  Moon,
  Sun,
  Target,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavSection = "movement" | "analysis" | "health";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  lottieFile?: string;
  section: NavSection;
  showInBottomNav?: boolean;
}

export const SECTION_ORDER: NavSection[] = ["movement", "analysis", "health"];

export const SECTION_LABELS: Record<NavSection, string> = {
  movement: "Bewegung",
  analysis: "Analyse",
  health: "Gesundheit",
};

export const NAV_ITEMS: NavItem[] = [
  // Bewegung
  { href: "/", label: "Home", icon: Home, lottieFile: "home", section: "movement", showInBottomNav: true },
  { href: "/stream", label: "Stream", icon: Users, lottieFile: "customer", section: "movement", showInBottomNav: true },
  { href: "/activities", label: "Aktivitäten", icon: Activity, lottieFile: "activity-feed", section: "movement", showInBottomNav: true },
  { href: "/calendar", label: "Kalender", icon: Calendar, lottieFile: "calendar", section: "movement", showInBottomNav: true },
  { href: "/groups", label: "Gruppen", icon: Layers, lottieFile: "map", section: "movement" },
  // Analyse
  { href: "/stats", label: "Statistiken", icon: BarChart3, lottieFile: "stats", section: "analysis" },
  { href: "/training-load", label: "Form", icon: TrendingUp, lottieFile: "energy", section: "analysis" },
  { href: "/goals", label: "Ziele", icon: Target, lottieFile: "goals", section: "analysis" },
  { href: "/trophies", label: "Trophäen", icon: Trophy, lottieFile: "trophy", section: "analysis" },
  // Gesundheit
  { href: "/daily", label: "Tag", icon: Sun, lottieFile: "daily", section: "health" },
  { href: "/sleep", label: "Schlaf", icon: Moon, lottieFile: "sleep", section: "health" },
  { href: "/health", label: "Gesundheit", icon: Heart, lottieFile: "heartbeat", section: "health" },
];

export const ITEMS_BY_SECTION: Record<NavSection, NavItem[]> = {
  movement: NAV_ITEMS.filter((i) => i.section === "movement"),
  analysis: NAV_ITEMS.filter((i) => i.section === "analysis"),
  health: NAV_ITEMS.filter((i) => i.section === "health"),
};

export const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((i) => i.showInBottomNav);
export const MORE_SHEET_ITEMS = NAV_ITEMS.filter((i) => !i.showInBottomNav);

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function isMoreActive(pathname: string): boolean {
  return MORE_SHEET_ITEMS.some((i) => isActive(pathname, i.href));
}
