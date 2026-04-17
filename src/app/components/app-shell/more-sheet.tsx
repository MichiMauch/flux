"use client";

import { LogOut } from "lucide-react";
import { BottomSheet } from "../bottom-sheet";
import { NavLink } from "./nav-link";
import { SECONDARY_ITEMS } from "./nav-items";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  logoutAction: () => void;
}

export function MoreSheet({ open, onClose, logoutAction }: MoreSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Mehr">
      <div className="p-2">
        <div className="grid grid-cols-1 gap-1">
          {SECONDARY_ITEMS.map((item) => (
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

        <div className="my-2 border-t border-border" />

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
