"use client";

import { NavLink } from "./nav-link";
import { PRIMARY_ITEMS, SECONDARY_ITEMS } from "./nav-items";

interface AppSidebarProps {
  collapsed: boolean;
}

export function AppSidebar({ collapsed }: AppSidebarProps) {
  const width = collapsed ? "w-16" : "w-60";

  return (
    <aside
      className={`hidden lg:flex fixed left-0 top-14 bottom-0 z-30 flex-col border-r border-border bg-background transition-[width] duration-200 ${width}`}
    >
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60">
              Übersicht
            </div>
          )}
          {PRIMARY_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              variant="side"
              collapsed={collapsed}
            />
          ))}
        </div>

        <div className="space-y-1">
          {!collapsed && (
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60">
              Mehr
            </div>
          )}
          {SECONDARY_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              variant="side"
              collapsed={collapsed}
            />
          ))}
        </div>
      </nav>
    </aside>
  );
}
