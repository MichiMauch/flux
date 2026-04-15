"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function TrophyRescanButton() {
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    try {
      const res = await fetch("/api/trophies/rescan", { method: "POST" });
      const data = await res.json();
      if (res.ok && (data.unlocked?.length ?? 0) > 0) {
        window.location.reload();
      } else if (res.ok) {
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface transition-colors disabled:opacity-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
      {busy ? "Prüfe..." : "Neu prüfen"}
    </button>
  );
}
