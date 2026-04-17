"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BpSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync/bloodpressure", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(
          data.synced > 0
            ? `${data.synced} neue Messung(en)`
            : "Alles aktuell"
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
        <span className="text-xs text-[#d0c5ba]">{result}</span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncing}
        className="border-[#3a3128] bg-black/40 text-white hover:bg-black/60 hover:text-white"
      >
        <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Sync..." : "Sync"}
      </Button>
    </div>
  );
}
