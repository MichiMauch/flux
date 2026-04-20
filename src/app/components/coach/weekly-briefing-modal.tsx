"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { spaceMono } from "../bento/bento-fonts";
import {
  WeeklyBriefingCard,
  type WeeklyBriefingCardData,
} from "./weekly-briefing-card";

interface LatestResponse {
  briefing:
    | (WeeklyBriefingCardData & {
        seenAt: string | null;
        model: string;
      })
    | null;
}

/**
 * Shows the latest weekly briefing as a modal the first time the user
 * opens the app after a new briefing was generated. The "seen" signal is
 * server-side (weekly_briefings.seen_at) so dismissing once hides the
 * modal on every device.
 */
export function WeeklyBriefingModal() {
  const [data, setData] = useState<WeeklyBriefingCardData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/coach/weekly-briefing/latest", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as LatestResponse;
        if (cancelled) return;
        if (!json.briefing) return;
        if (json.briefing.seenAt) return;
        setData(json.briefing);
        setOpen(true);
      } catch {
        // silent: modal is non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismiss() {
    setOpen(false);
    if (!data) return;
    try {
      await fetch("/api/coach/weekly-briefing/seen", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isoWeek: data.isoWeek }),
      });
    } catch {
      // ignore — the server-side state will eventually catch up.
    }
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !data) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wochen-Briefing"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-6 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl border border-[#2a2a2a] bg-[#0f0f0f] p-5 sm:rounded-2xl sm:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#2a2a2a] bg-black/60 text-[#a3a3a3] transition-colors hover:border-[#3a3a3a] hover:text-white"
          aria-label="Schliessen"
        >
          <X className="h-4 w-4" />
        </button>

        <WeeklyBriefingCard data={data} />

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className={`${spaceMono.className} rounded-md border border-[#FF6A00] bg-[#FF6A00]/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF6A00] transition-colors hover:bg-[#FF6A00]/20`}
          >
            Verstanden
          </button>
        </div>
      </div>
    </div>
  );
}
