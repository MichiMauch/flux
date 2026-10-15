"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { BottomSheet } from "../components/bottom-sheet";
import { spaceMono } from "../components/bento/bento-fonts";
import { ACTIVITY_TYPE_OPTIONS, showsTerrain } from "@/lib/activity-types";

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-base focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft transition-colors";
const labelCls =
  "block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1.5";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Vorbelegung: heute, vor einer Stunde, auf die Viertelstunde abgerundet. */
function defaultStart(): { date: string; time: string } {
  const d = new Date(Date.now() - 60 * 60_000);
  d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function NewActivityButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [type, setType] = useState("RUNNING");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [ascent, setAscent] = useState("");
  const [avgHeartRate, setAvgHeartRate] = useState("");
  const [calories, setCalories] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openSheet() {
    const start = defaultStart();
    setType("RUNNING");
    setDate(start.date);
    setTime(start.time);
    setHours("");
    setMinutes("");
    setDistanceKm("");
    setAscent("");
    setAvgHeartRate("");
    setCalories("");
    setName("");
    setNotes("");
    setError(null);
    setOpen(true);
  }

  const terrain = showsTerrain(type);

  async function handleSave() {
    const durationSec = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60;
    if (durationSec <= 0) {
      setError("Bitte eine Dauer angeben.");
      return;
    }
    const start = new Date(`${date}T${time}`);
    if (!date || !time || Number.isNaN(start.getTime())) {
      setError("Bitte Datum und Startzeit angeben.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const km = distanceKm.trim().replace(",", ".");
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          // Lokale Eingabe im Browser in einen festen Zeitpunkt umrechnen.
          startTime: start.toISOString(),
          duration: durationSec,
          distance: terrain && km ? Number(km) * 1000 : null,
          ascent: terrain && ascent.trim() ? Number(ascent) : null,
          avgHeartRate: avgHeartRate.trim() ? Number(avgHeartRate) : null,
          calories: calories.trim() ? Number(calories) : null,
          name: name.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setOpen(false);
      router.push(`/activity/${data.activityId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a] cursor-pointer`}
      >
        + Erfassen
      </button>

      <BottomSheet
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Aktivität erfassen"
        footer={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="flex-1 h-11 rounded-md border border-border text-sm font-semibold hover:bg-surface cursor-pointer disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-11 rounded-md bg-foreground text-background text-sm font-semibold hover:bg-brand disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Speichern
            </button>
          </div>
        }
      >
        <div className="p-4 space-y-5">
          <label className="block">
            <span className={labelCls}>Sportart</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              {ACTIVITY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Datum</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Startzeit</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Dauer (Std.)</span>
              <input
                type="number"
                min={0}
                max={48}
                inputMode="numeric"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Dauer (Min.)</span>
              <input
                type="number"
                min={0}
                max={59}
                inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="45"
                className={inputCls}
              />
            </label>
          </div>

          {terrain && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Distanz (km)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  placeholder="optional"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Aufstieg (m)</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={ascent}
                  onChange={(e) => setAscent(e.target.value)}
                  placeholder="optional"
                  className={inputCls}
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Ø Puls</span>
              <input
                type="number"
                min={30}
                max={250}
                inputMode="numeric"
                value={avgHeartRate}
                onChange={(e) => setAvgHeartRate(e.target.value)}
                placeholder="optional"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Kalorien</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="optional"
                className={inputCls}
              />
            </label>
          </div>

          <label className="block">
            <span className={labelCls}>Titel</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="leer lassen für automatischen Titel"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className={labelCls}>Notiz</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Wie war's?"
              className={inputCls}
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-xs">
              <X className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
