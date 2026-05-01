"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "./nav-link";
import { NavLottie } from "./nav-lottie";
import { MOBILE_PRIMARY_ITEMS, isMoreActive } from "./nav-items";

interface AppBottomNavProps {
  onOpenMore: () => void;
}

export function AppBottomNav({ onOpenMore }: AppBottomNavProps) {
  const pathname = usePathname();
  const moreActive = isMoreActive(pathname);
  const [moreHover, setMoreHover] = useState(false);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background"
      style={{ paddingBottom: "max(0rem, env(safe-area-inset-bottom))" }}
      aria-label="Hauptnavigation"
    >
      <div className="flex">
        {MOBILE_PRIMARY_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            lottieFile={item.lottieFile}
            variant="bottom"
          />
        ))}
        <button
          type="button"
          onClick={onOpenMore}
          onMouseEnter={() => setMoreHover(true)}
          onMouseLeave={() => setMoreHover(false)}
          onTouchStart={() => setMoreHover(true)}
          onTouchEnd={() => setMoreHover(false)}
          aria-label="Mehr"
          aria-expanded={false}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
            moreActive
              ? "text-[color:var(--brand)]"
              : "text-foreground/75 hover:text-foreground"
          }`}
        >
          <NavLottie file="more" size={26} playing={moreHover} />
          <span className="tracking-tight">Mehr</span>
        </button>
      </div>
    </nav>
  );
}
