"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { spaceMono } from "../components/bento/bento-fonts";
import { removeActivityFromTour } from "./actions";

interface Props {
  tourId: string;
  activityId: string;
  activityName: string;
}

export function TourMemberRemoveButton({
  tourId,
  activityId,
  activityName,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleRemove() {
    setBusy(true);
    try {
      await removeActivityFromTour(tourId, activityId);
      toast.success(`"${activityName}" entfernt`);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Entfernen fehlgeschlagen"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleRemove}
      className={`${spaceMono.className} inline-flex items-center rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a] disabled:opacity-60`}
    >
      {busy ? "…" : "Entfernen"}
    </button>
  );
}
