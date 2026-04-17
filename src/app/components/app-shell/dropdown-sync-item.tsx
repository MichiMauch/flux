"use client";

import { useState } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { NavLottie } from "./nav-lottie";

export function DropdownSyncItem() {
  const [syncing, setSyncing] = useState(false);
  const [hover, setHover] = useState(false);

  async function handleSync(event: React.MouseEvent) {
    event.preventDefault();
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.synced > 0) {
        window.location.reload();
      }
    } catch {
      // silent fail — user can retry
    } finally {
      setSyncing(false);
    }
  }

  return (
    <DropdownMenuItem
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleSync}
      disabled={syncing}
      className="gap-2"
    >
      <NavLottie file="sync" size={22} playing={hover || syncing} />
      <span>{syncing ? "Sync…" : "Sync"}</span>
    </DropdownMenuItem>
  );
}
