"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

const NEON = "#FF6A00";

export function BentoSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(
          data.synced > 0 ? `${data.synced} neue Aktivität(en)` : "Alles aktuell"
        );
        if (data.synced > 0) window.location.reload();
      } else {
        setResult(data.error || "Fehler");
      }
    } catch {
      setResult("Sync fehlgeschlagen");
    } finally {
      setSyncing(false);
      setTimeout(() => setResult(null), 3000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className="[font-family:var(--bento-mono)] text-[10px] uppercase tracking-[0.14em] text-[#9ca3af]">
          {result}
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] transition-all disabled:opacity-50"
        style={{
          borderColor: NEON,
          color: NEON,
          boxShadow: `0 0 10px ${NEON}55, inset 0 0 10px ${NEON}22`,
          background: `${NEON}10`,
          fontFamily: "var(--bento-mono)",
        }}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Sync…" : "Sync"}
      </button>
    </div>
  );
}
