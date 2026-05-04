"use client";

import { LogOut } from "lucide-react";
import { BottomSheet } from "../bottom-sheet";
import { NavLink } from "./nav-link";
import {
  MORE_SHEET_ITEMS,
  SECTION_LABELS,
  SECTION_ORDER,
  type NavSection,
} from "./nav-items";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  logoutAction: () => void;
}

export function MoreSheet({ open, onClose, logoutAction }: MoreSheetProps) {
  const itemsBySection: Record<NavSection, typeof MORE_SHEET_ITEMS> = {
    movement: MORE_SHEET_ITEMS.filter((i) => i.section === "movement"),
    analysis: MORE_SHEET_ITEMS.filter((i) => i.section === "analysis"),
    health: MORE_SHEET_ITEMS.filter((i) => i.section === "health"),
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Mehr">
      <div className="p-2 space-y-4">
        {SECTION_ORDER.map((section) => {
          const items = itemsBySection[section];
          if (items.length === 0) return null;
          return (
            <div key={section} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/60">
                {SECTION_LABELS[section]}
              </div>
              <div className="grid grid-cols-1 gap-1">
                {items.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    lottieFile={item.lottieFile}
                    variant="side"
                    onClick={onClose}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <div className="border-t border-border" />

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-surface/60 hover:text-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>Abmelden</span>
          </button>
        </form>
      </div>
    </BottomSheet>
  );
}
