"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { spaceMono } from "../components/bento/bento-fonts";
import { deleteGroup } from "./actions";

interface Props {
  groupId: string;
  groupName: string;
}

export function GroupDeleteButton({ groupId, groupName }: Props) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (
      !confirm(
        `Gruppe "${groupName}" wirklich löschen? Die Aktivitäten bleiben erhalten.`
      )
    )
      return;
    setBusy(true);
    try {
      await deleteGroup(groupId);
      toast.success("Gruppe gelöscht");
      router.push("/groups");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Löschen fehlgeschlagen"
      );
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleDelete}
      className={`${spaceMono.className} inline-flex items-center rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-red-300 hover:border-red-700 hover:text-red-200 disabled:opacity-60`}
    >
      {busy ? "Löschen …" : "Gruppe löschen"}
    </button>
  );
}
