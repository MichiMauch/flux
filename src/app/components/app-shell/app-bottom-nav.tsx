"use client";

import { MoreHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";
import { NavLink } from "./nav-link";
import { PRIMARY_ITEMS, isSecondaryActive } from "./nav-items";

interface AppBottomNavProps {
  onOpenMore: () => void;
}

export function AppBottomNav({ onOpenMore }: AppBottomNavProps) {
  const pathname = usePathname();
  const moreActive = isSecondaryActive(pathname);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background"
      style={{ paddingBottom: "max(0rem, env(safe-area-inset-bottom))" }}
      aria-label="Hauptnavigation"
    >
      <div className="flex">
        {PRIMARY_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            variant="bottom"
          />
        ))}
        <button
          type="button"
          onClick={onOpenMore}
          aria-label="Mehr"
          aria-expanded={false}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
            moreActive
              ? "text-[color:var(--brand)]"
              : "text-foreground/75 hover:text-foreground"
          }`}
        >
          <MoreHorizontal
            className="h-5 w-5"
            strokeWidth={moreActive ? 2.25 : 1.75}
          />
          <span className="tracking-tight">Mehr</span>
        </button>
      </div>
    </nav>
  );
}
