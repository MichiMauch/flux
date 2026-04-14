"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex md:items-center md:justify-center items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-150"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="relative w-full md:max-w-lg bg-background border border-border md:rounded-lg rounded-t-xl shadow-xl flex flex-col animate-in slide-in-from-bottom md:fade-in md:zoom-in-95 duration-200"
        style={{ maxHeight: "90dvh" }}
        role="dialog"
        aria-modal="true"
      >
        {/* Handle (mobile only) */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 pt-3 pb-3 border-b border-border">
            <h2 className="text-base font-bold tracking-[-0.02em]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-surface text-muted-foreground"
              aria-label="Schliessen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="border-t border-border bg-background px-4 py-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
