import {
  Activity,
  BarChart3,
  Calendar,
  Heart,
  Home,
  Sun,
  Target,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";

export type NavGroup = "primary" | "secondary";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home, group: "primary" },
  { href: "/activities", label: "Aktivitäten", icon: Activity, group: "primary" },
  { href: "/calendar", label: "Kalender", icon: Calendar, group: "primary" },
  { href: "/stats", label: "Statistiken", icon: BarChart3, group: "primary" },
  { href: "/daily", label: "Tag", icon: Sun, group: "secondary" },
  { href: "/goals", label: "Ziele", icon: Target, group: "secondary" },
  { href: "/trophies", label: "Trophäen", icon: Trophy, group: "secondary" },
  { href: "/health", label: "Gesundheit", icon: Heart, group: "secondary" },
  { href: "/profile", label: "Profil", icon: User, group: "secondary" },
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
