"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { spaceMono } from "../components/bento/bento-fonts";
import { updateGroup } from "./actions";

interface Props {
  groupId: string;
  initial: {
    name: string;
    description: string | null;
    startDate: string;
    endDate: string;
    sharedWithPartner: boolean;
  };
  partnerName: string | null;
}

export function GroupDetailsForm({ groupId, initial, partnerName }: Props) {
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await updateGroup(groupId, fd);
      toast.success("Gruppe gespeichert");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-6"
    >
      <h2
        className={`${spaceMono.className} text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
      >
        Details
      </h2>

      <div className="space-y-2">
        <label
          htmlFor="name"
          className={`${spaceMono.className} block text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
        >
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={initial.name}
          className="w-full rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="description"
          className={`${spaceMono.className} block text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
        >
          Beschreibung
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={initial.description ?? ""}
          className="w-full rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label
            htmlFor="startDate"
            className={`${spaceMono.className} block text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
          >
            Start
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={initial.startDate}
            className="w-full rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="endDate"
            className={`${spaceMono.className} block text-[11px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]`}
          >
            Ende
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={initial.endDate}
            className="w-full rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
          />
        </div>
      </div>

      {partnerName ? (
        <div className="space-y-1 border-t border-[#1a1a1a] pt-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="sharedWithPartner"
              defaultChecked={initial.sharedWithPartner}
              className="mt-0.5 h-4 w-4 accent-[#ff6a00]"
            />
            <span className="flex-1">
              <span className="block text-sm text-white">
                Mit {partnerName} teilen
              </span>
              <span
                className={`${spaceMono.className} mt-0.5 block text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]`}
              >
                Lesezugriff auf Karte, Stats und Aktivitäten — kein Editieren
              </span>
            </span>
          </label>
        </div>
      ) : null}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={busy}
          className={`${spaceMono.className} inline-flex items-center rounded-md border border-[#ff6a00] bg-[#ff6a00] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-black hover:bg-[#ff8030] disabled:opacity-60`}
        >
          {busy ? "Speichern …" : "Speichern"}
        </button>
      </div>
    </form>
  );
}
