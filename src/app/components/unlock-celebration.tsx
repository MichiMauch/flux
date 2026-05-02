"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { getTrophy } from "@/lib/trophies";
import { TrophyIcon } from "./trophy-icon";
import { X } from "lucide-react";

interface Pending {
  id: string;
  trophyCode: string;
}

function fireConfetti() {
  const duration = 2500;
  const end = Date.now() + duration;
  const colors = ["#FF5B3A", "#FFC857", "#F7EFE6", "#52B788"];
  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function UnlockCelebration() {
  const [queue, setQueue] = useState<Pending[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trophies/pending");
        if (!res.ok) return;
        const data = await res.json();
        const pending = (data.pending ?? []) as Pending[];
        if (!cancelled && pending.length > 0) {
          setQueue(pending);
          setIndex(0);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = queue[index];
  const def = current ? getTrophy(current.trophyCode) : null;

  useEffect(() => {
    if (current) fireConfetti();
  }, [current]);

  if (!current || !def) return null;

  async function handleClose() {
    if (!current) return;
    const id = current.id;
    try {
      await fetch("/api/trophies/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      // ignore
    }
    if (index + 1 < queue.length) {
      setIndex(index + 1);
    } else {
      setQueue([]);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-sm rounded-2xl border border-border bg-background p-8 text-center shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-surface"
          aria-label="Schliessen"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand">
          Trophäe freigeschaltet!
        </div>
        <div className="mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full bg-surface">
          <TrophyIcon
            code={def.code}
            alt={def.title}
            className="h-20 w-20"
          />
        </div>
        <div className="mt-4 text-xl font-bold">{def.title}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {def.description}
        </div>
        <div className="mt-3 text-xs font-semibold text-brand">
          +{def.xpReward} XP
        </div>
        {queue.length > 1 && (
          <div className="mt-4 text-[10px] text-muted-foreground">
            {index + 1} / {queue.length}
          </div>
        )}
        <button
          onClick={handleClose}
          className="mt-6 w-full rounded-md bg-brand py-2 text-sm font-semibold text-background hover:opacity-90"
        >
          {index + 1 < queue.length ? "Nächste" : "Danke!"}
        </button>
      </div>
    </div>
  );
}
