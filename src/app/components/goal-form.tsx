"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { BottomSheet } from "./bottom-sheet";
import {
  parseActivityTypes,
  type GoalMetric,
  type GoalTimeframe,
} from "@/lib/goals";

const METRICS: { value: GoalMetric; label: string; unit: string }[] = [
  { value: "distance", label: "Distanz", unit: "km" },
  { value: "duration", label: "Aktivitätszeit", unit: "h" },
  { value: "ascent", label: "Aufstieg", unit: "m" },
  { value: "count", label: "Aktivitäten", unit: "" },
];
const TIMEFRAMES: { value: GoalTimeframe; label: string }[] = [
  { value: "week", label: "Pro Woche" },
  { value: "month", label: "Pro Monat" },
  { value: "year", label: "Pro Jahr" },
];
const TYPES: { value: string; label: string }[] = [
  { value: "RUNNING", label: "Laufen" },
  { value: "CYCLING", label: "Rad" },
  { value: "HIKING", label: "Wandern" },
  { value: "WALKING", label: "Gehen" },
];

const inputCls =
  "w-full rounded-md border border-[#3a3128] bg-black/40 px-3 py-2.5 text-base text-white placeholder:text-[#9ca3af] focus:outline-none focus:border-[#FF6A00]/70 focus:ring-[3px] focus:ring-[#FF6A00]/20 disabled:opacity-60";

interface ExistingGoal {
  id: string;
  title: string | null;
  metric: GoalMetric;
  activityType: string | null;
  timeframe: GoalTimeframe;
  targetValue: number;
}

interface GoalFormSheetProps {
  open: boolean;
  onClose: () => void;
  existing?: ExistingGoal | null;
}

function GoalFormSheet({ open, onClose, existing }: GoalFormSheetProps) {
  const router = useRouter();
  const isEdit = !!existing;

  const [metric, setMetric] = useState<GoalMetric>(existing?.metric ?? "distance");
  const [timeframe, setTimeframe] = useState<GoalTimeframe>(
    existing?.timeframe ?? "week"
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    parseActivityTypes(existing?.activityType ?? null)
  );
  const [targetValue, setTargetValue] = useState(
    existing ? String(existing.targetValue) : ""
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMetric(existing?.metric ?? "distance");
      setTimeframe(existing?.timeframe ?? "week");
      setSelectedTypes(parseActivityTypes(existing?.activityType ?? null));
      setTargetValue(existing ? String(existing.targetValue) : "");
      setTitle(existing?.title ?? "");
      setError(null);
    }
  }, [open, existing]);

  function toggleType(value: string) {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  const allTypesSelected = selectedTypes.length === 0;

  async function handleSave() {
    setError(null);
    const n = Number(targetValue);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Zielwert muss eine positive Zahl sein.");
      return;
    }
    setSaving(true);
    try {
      const res = isEdit
        ? await fetch(`/api/goals/${existing!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetValue: n,
              title: title || "",
              activityTypes: selectedTypes,
            }),
          })
        : await fetch("/api/goals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              metric,
              timeframe,
              activityTypes: selectedTypes,
              targetValue: n,
              title: title || null,
            }),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Speichern fehlgeschlagen");
      }
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  const activeMetric = METRICS.find((m) => m.value === metric)!;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEdit ? "Ziel bearbeiten" : "Neues Ziel"}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-md border border-[#3a3128] text-sm font-semibold text-white hover:bg-black/40"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-11 rounded-md bg-[#FF6A00] text-black text-sm font-bold uppercase tracking-[0.08em] hover:bg-[#FF8533] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Speichern
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-5">
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#d0c5ba]">
              Sportart{selectedTypes.length > 1 ? "en" : ""}
            </span>
            <span className="text-[10px] text-[#9ca3af]">
              {allTypesSelected
                ? "Alle Sportarten"
                : `${selectedTypes.length} ausgewählt`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Sportarten">
            <button
              type="button"
              onClick={() => setSelectedTypes([])}
              aria-pressed={allTypesSelected}
              className={`h-11 rounded-md border text-sm font-semibold transition-colors ${
                allTypesSelected
                  ? "border-[#FF6A00]/70 bg-[#FF6A00]/15 text-white"
                  : "border-[#3a3128] bg-black/40 text-[#9ca3af] hover:text-white"
              }`}
            >
              Alle Sportarten
            </button>
            {TYPES.map((t) => {
              const active = selectedTypes.includes(t.value);
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleType(t.value)}
                  aria-pressed={active}
                  className={`h-11 rounded-md border text-sm font-semibold transition-colors ${
                    active
                      ? "border-[#FF6A00]/70 bg-[#FF6A00]/15 text-white"
                      : "border-[#3a3128] bg-black/40 text-[#9ca3af] hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-[#9ca3af]">
            Tipp: Mehrere Sportarten kombinieren — z. B. Wandern + Gehen.
          </p>
        </div>

        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#d0c5ba] mb-1.5">
            Metrik {isEdit && <span className="normal-case text-[#9ca3af]">(nicht änderbar)</span>}
          </span>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as GoalMetric)}
            className={inputCls}
            disabled={isEdit}
          >
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#d0c5ba] mb-1.5">
            Zeitraum {isEdit && <span className="normal-case text-[#9ca3af]">(nicht änderbar)</span>}
          </span>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as GoalTimeframe)}
            className={inputCls}
            disabled={isEdit}
          >
            {TIMEFRAMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#d0c5ba] mb-1.5">
            Zielwert {activeMetric.unit && `(${activeMetric.unit})`}
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className={inputCls}
            placeholder={
              metric === "distance"
                ? "z.B. 20"
                : metric === "duration"
                  ? "z.B. 5"
                  : metric === "ascent"
                    ? "z.B. 500"
                    : "z.B. 4"
            }
          />
        </label>

        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#d0c5ba] mb-1.5">
            Titel (optional)
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className={inputCls}
            placeholder="Leer lassen für automatischen Titel"
          />
        </label>

        {error && (
          <div className="p-3 rounded-md border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
            {error}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

export function NewGoalButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-[#FF6A00] text-black px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] hover:bg-[#FF8533] transition-colors"
      >
        <Plus className="h-4 w-4" />
        Neues Ziel
      </button>
      <GoalFormSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function EditGoalButton({ goal }: { goal: ExistingGoal }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-md text-[#9ca3af] hover:text-white hover:bg-black/40"
        aria-label="Bearbeiten"
      >
        <PencilIcon />
      </button>
      <GoalFormSheet open={open} onClose={() => setOpen(false)} existing={goal} />
    </>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
