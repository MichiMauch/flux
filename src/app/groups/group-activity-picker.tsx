"use client";

import { useState, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
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
  availableSports: string[];
}

export function GroupActivityPicker({
  groupId,
  candidates,
  availableSports,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate
      ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1
      : null;
    return candidates.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q)) return false;
      if (sport && a.type !== sport) return false;
      const ts = new Date(a.startTime).getTime();
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;
      return true;
    });
  }, [candidates, query, sport, fromDate, toDate]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const a of filtered) next.add(a.id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setBusy(true);
    const count = selected.size;
    try {
      await addActivitiesToGroup(groupId, Array.from(selected));
      toast.success(
        `${count} ${count === 1 ? "Aktivität" : "Aktivitäten"} hinzugefügt`
      );
      setSelected(new Set());
      setOpen(false);
      setQuery("");
      setSport("");
      setFromDate("");
      setToDate("");
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Hinzufügen fehlgeschlagen"
      );
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
            setSport("");
            setFromDate("");
            setToDate("");
          }}
          className="text-xs uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white"
        >
          Abbrechen
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          className="rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
        >
          <option value="">Alle Sportarten</option>
          {availableSports.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          aria-label="Von Datum"
          className="rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          aria-label="Bis Datum"
          className="rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff6a00]"
        />
      </div>

      {candidates.length === 0 ? (
        <p className="text-sm text-[#a3a3a3]">
          Alle deine Aktivitäten sind bereits in dieser Gruppe.
        </p>
      ) : filtered.length === 0 ? (
        <p className="p-3 text-center text-xs text-[#a3a3a3]">Keine Treffer.</p>
      ) : (
        <div
          ref={scrollRef}
          className="max-h-80 overflow-auto rounded-md border border-[#1a1a1a]"
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
              width: "100%",
            }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const a = filtered[vi.index];
              return (
                <label
                  key={a.id}
                  className="absolute left-0 right-0 flex cursor-pointer items-center gap-3 border-b border-[#1a1a1a] p-2 hover:bg-[#111]"
                  style={{
                    top: 0,
                    transform: `translateY(${vi.start}px)`,
                    height: vi.size,
                  }}
                >
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
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]">
            {selected.size} ausgewählt · {filtered.length} sichtbar ·{" "}
            {candidates.length} insgesamt
          </span>
          {filtered.length > 0 ? (
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white"
            >
              Alle sichtbaren wählen
            </button>
          ) : null}
          {selected.size > 0 ? (
            <button
              type="button"
              onClick={clearSelection}
              className="text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white"
            >
              Auswahl leeren
            </button>
          ) : null}
        </div>
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
