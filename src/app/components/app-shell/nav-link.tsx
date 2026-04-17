"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { isActive } from "./nav-items";

type Variant = "side" | "bottom";

interface NavLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
  variant: Variant;
  collapsed?: boolean;
  forceActive?: boolean;
  onClick?: () => void;
}

export function NavLink({
  href,
  label,
  icon: Icon,
  variant,
  collapsed = false,
  forceActive,
  onClick,
}: NavLinkProps) {
  const pathname = usePathname();
  const active = forceActive ?? isActive(pathname, href);

  if (variant === "bottom") {
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
          active
            ? "text-[color:var(--brand)]"
            : "text-foreground/75 hover:text-foreground"
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
        <span className="tracking-tight">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-surface text-foreground"
          : "text-foreground/80 hover:bg-surface/60 hover:text-foreground"
      } ${collapsed ? "justify-center px-2" : ""}`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${
          active ? "text-[color:var(--brand)]" : ""
        }`}
        strokeWidth={active ? 2.25 : 1.75}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
