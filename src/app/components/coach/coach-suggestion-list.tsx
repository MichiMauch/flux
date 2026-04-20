"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { spaceMono } from "../bento/bento-fonts";
import type { CoachSuggestions } from "@/lib/coach-prompt";
import { CoachSuggestionCard } from "./coach-suggestion-card";

const NEON = "#FF6A00";

interface InitialData {
  suggestions: CoachSuggestions;
  generatedAt: string; // ISO
  model: string;
  cached: boolean;
}

export function CoachSuggestionList({ initial }: { initial: InitialData }) {
  const [data, setData] = useState<InitialData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function refresh() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/coach/suggestions?force=1", {
          method: "POST",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData({
          suggestions: json.suggestions,
          generatedAt: json.generatedAt,
          model: json.model,
          cached: json.cached,
        });
      } catch (err) {
        console.error("[coach] refresh failed:", err);
        setError("Aktualisierung fehlgeschlagen. Probier es nochmal.");
      }
    });
  }

  const sorted = [...data.suggestions.suggestions].sort(
    (a, b) => a.dayOffset - b.dayOffset
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`${spaceMono.className} text-[12px] font-bold leading-snug`}
            style={{ color: NEON }}
          >
            {data.suggestions.headline}
          </p>
          <p
            className={`${spaceMono.className} mt-2 text-[11px] leading-relaxed text-[#d4d4d4]`}
          >
            {data.suggestions.reasoning}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          className={`${spaceMono.className} shrink-0 inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-black/40 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors hover:border-[#3a3a3a] disabled:opacity-60`}
          style={{ color: pending ? "#a3a3a3" : NEON }}
          aria-label="Neu holen"
        >
          <RefreshCw
            className={`h-3 w-3 ${pending ? "animate-spin" : ""}`}
          />
          {pending ? "…" : "Neu"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((s, i) => (
          <CoachSuggestionCard key={`${s.dayOffset}-${i}`} suggestion={s} />
        ))}
      </div>

      <div
        className={`${spaceMono.className} flex items-center justify-between text-[9px] uppercase tracking-[0.14em] text-[#737373]`}
      >
        <span>
          {data.cached ? "Aus Cache" : "Frisch generiert"} · {relativeTime(data.generatedAt)}
        </span>
        <span>{data.model}</span>
      </div>

      {error && (
        <p className={`${spaceMono.className} text-[11px] text-[#EF4444]`}>
          {error}
        </p>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return `vor ${diffD} Tagen`;
}
