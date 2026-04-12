"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncButton() {
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
          data.synced > 0
            ? `${data.synced} neue Aktivität(en)`
            : "Alles aktuell"
        );
        if (data.synced > 0) {
          window.location.reload();
        }
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
        <span className="text-xs text-muted-foreground">{result}</span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncing}
      >
        <RefreshCw
          className={`h-4 w-4 mr-1.5 ${syncing ? "animate-spin" : ""}`}
        />
        {syncing ? "Sync..." : "Sync"}
      </Button>
    </div>
  );
}
