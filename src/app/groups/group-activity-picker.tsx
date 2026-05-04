"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { addActivitiesToGroup } from "./actions";
import { formatDistanceAuto } from "@/lib/activity-format";

export interface PickableActivity {
  id: string;
  name: string;
  type: string;
  startTime: Date;
  distance: number | null;
}

interface Props {
  groupId: string;
  candidates: PickableActivity[];
}

export function GroupActivityPicker({ groupId, candidates }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (a) =>
        a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q)
    );
  }, [candidates, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await addActivitiesToGroup(groupId, Array.from(selected));
      setSelected(new Set());
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white hover:border-[#4a4a4a]"
      >
        + Aktivitäten hinzufügen
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-4">
      <div className="flex items-center justify-between gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen …"
          className="flex-1 rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
        />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setSelected(new Set());
            setQuery("");
          }}
          className="text-xs uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white"
        >
          Abbrechen
        </button>
      </div>

      {candidates.length === 0 ? (
        <p className="text-sm text-[#a3a3a3]">
          Alle deine Aktivitäten sind bereits in dieser Gruppe.
        </p>
      ) : (
        <div className="max-h-80 overflow-auto rounded-md border border-[#1a1a1a]">
          <ul className="divide-y divide-[#1a1a1a]">
            {filtered.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-center gap-3 p-2 hover:bg-[#111]">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggle(a.id)}
                    className="h-4 w-4 accent-[#ff6a00]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white">{a.name}</div>
                    <div className="flex flex-wrap items-center gap-x-3 text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]">
                      <span>{a.type}</span>
                      <span>
                        {new Date(a.startTime).toLocaleDateString("de-CH", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {a.distance ? (
                        <span>{formatDistanceAuto(a.distance, 1)}</span>
                      ) : null}
                    </div>
                  </div>
                </label>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="p-3 text-center text-xs text-[#a3a3a3]">
                Keine Treffer.
              </li>
            ) : null}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]">
          {selected.size} ausgewählt
        </span>
        <button
          type="button"
          onClick={handleAdd}
          disabled={selected.size === 0 || busy}
          className="inline-flex items-center rounded-md border border-[#ff6a00] bg-[#ff6a00] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-black hover:bg-[#ff8030] disabled:opacity-50"
        >
          Hinzufügen
        </button>
      </div>
    </div>
  );
}
