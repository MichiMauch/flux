"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, Loader2, X } from "lucide-react";
import { spaceMono } from "../components/bento/bento-fonts";

const NEON = "#FF6A00";
const DIM = "#a3a3a3";

const MONTH_SHORT_DE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

export interface MonthCount {
  /** "YYYY-MM" */
  key: string;
  count: number;
}

interface Props {
  months: MonthCount[];
  monthKey: string | null;
  basePath: string;
  sport: string | null;
}

function splitKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-");
  return { year: parseInt(y, 10), month: parseInt(m, 10) };
}

function buildHref(
  basePath: string,
  sport: string | null,
  monthKey: string | null
): string {
  const p = new URLSearchParams();
  if (sport) p.set("sport", sport);
  if (monthKey) p.set("month", monthKey);
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function labelFor(monthKey: string): string {
  const { year, month } = splitKey(monthKey);
  return `${MONTH_SHORT_DE[month - 1]} ${year}`;
}

export function ActivitiesDateFilter({
  months,
  monthKey,
  basePath,
  sport,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const navigate = (next: string | null) => {
    setOpen(false);
    startTransition(() => {
      router.push(buildHref(basePath, sport, next), { scroll: false });
    });
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  // Escape closes the popup
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const { byYear, years, maxCount } = useMemo(() => {
    const byYear = new Map<number, Map<number, number>>();
    let maxCount = 0;
    for (const { key, count } of months) {
      const { year, month } = splitKey(key);
      if (!byYear.has(year)) byYear.set(year, new Map());
      byYear.get(year)!.set(month, count);
      if (count > maxCount) maxCount = count;
    }
    const years = Array.from(byYear.keys()).sort((a, b) => b - a);
    return { byYear, years, maxCount };
  }, [months]);

  const active = monthKey ? splitKey(monthKey) : null;
  const initialYear = active?.year ?? years[0] ?? null;
  const [selectedYear, setSelectedYear] = useState<number | null>(initialYear);

  // Keep mobile year row in sync when the URL filter changes externally.
  // Prev-comparison instead of an effect avoids the render→effect→setState
  // cascade flagged by react-hooks/set-state-in-effect.
  const currentActiveYear = active?.year ?? null;
  const [prevActiveYear, setPrevActiveYear] = useState(currentActiveYear);
  if (currentActiveYear !== prevActiveYear) {
    setPrevActiveYear(currentActiveYear);
    if (currentActiveYear !== null) setSelectedYear(currentActiveYear);
  }

  if (months.length === 0) return null;

  const triggerLabel = monthKey ? labelFor(monthKey) : "Alle Daten";

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`${spaceMono.className} inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition`}
          style={
            monthKey
              ? {
                  borderColor: NEON,
                  color: NEON,
                  background: "rgba(255,106,0,0.08)",
                  boxShadow: `0 0 8px ${NEON}66`,
                  textShadow: `0 0 4px ${NEON}aa`,
                }
              : {
                  borderColor: "#2a2a2a",
                  color: DIM,
                  background: "#0f0f0f",
                }
          }
        >
          <span aria-hidden>📅</span>
          <span>{triggerLabel}</span>
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ChevronDown
              className="h-3 w-3 transition-transform"
              style={{ transform: open ? "rotate(180deg)" : undefined }}
            />
          )}
        </button>
        {monthKey && !pending && (
          <button
            type="button"
            onClick={() => navigate(null)}
            aria-label="Datumsfilter zurücksetzen"
            title="Filter aufheben"
            className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Datum wählen"
          className="absolute z-30 mt-2 w-full md:w-[640px] max-w-[92vw] rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-3 shadow-xl"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(255,106,0,0.04) 0%, transparent 60%)",
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span
              className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.22em] text-[#6a6a6a]`}
            >
              {monthKey ? `Aktiv: ${triggerLabel}` : "Datum wählen"}
            </span>
            <div className="flex items-center gap-1">
              {monthKey && (
                <button
                  type="button"
                  onClick={() => navigate(null)}
                  className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
                >
                  Alle anzeigen
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Schließen"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#2a2a2a] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Mobile: Variante 1 — Jahre + Monate als Chips */}
          <div className="md:hidden space-y-3">
            <YearMonthChips
              years={years}
              byYear={byYear}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              monthKey={monthKey}
              onPick={(key) => navigate(key)}
            />
          </div>

          {/* Desktop: Variante 2 — Heatmap */}
          <div className="hidden md:block">
            <Heatmap
              years={years}
              byYear={byYear}
              maxCount={maxCount}
              monthKey={monthKey}
              onPick={(key) => navigate(key)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function YearMonthChips({
  years,
  byYear,
  selectedYear,
  setSelectedYear,
  monthKey,
  onPick,
}: {
  years: number[];
  byYear: Map<number, Map<number, number>>;
  selectedYear: number | null;
  setSelectedYear: (y: number) => void;
  monthKey: string | null;
  onPick: (key: string) => void;
}) {
  const activeKey = monthKey;
  const yearMonths = selectedYear ? byYear.get(selectedYear) : null;

  return (
    <>
      <div>
        <div
          className={`${spaceMono.className} mb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#6a6a6a]`}
        >
          Jahr
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
          {years.map((y) => {
            const isSelected = selectedYear === y;
            return (
              <button
                key={y}
                type="button"
                onClick={() => setSelectedYear(y)}
                className={`${spaceMono.className} shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition`}
                style={
                  isSelected
                    ? {
                        borderColor: NEON,
                        color: NEON,
                        background: "rgba(255,106,0,0.1)",
                        boxShadow: `0 0 8px ${NEON}66`,
                      }
                    : {
                        borderColor: "#2a2a2a",
                        color: DIM,
                        background: "#0f0f0f",
                      }
                }
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div
          className={`${spaceMono.className} mb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#6a6a6a]`}
        >
          Monat
        </div>
        <div className="grid grid-cols-4 gap-1">
          {MONTH_SHORT_DE.map((m, i) => {
            const monthNum = i + 1;
            const count = yearMonths?.get(monthNum) ?? 0;
            const has = count > 0;
            const key = `${selectedYear}-${String(monthNum).padStart(2, "0")}`;
            const isActive = activeKey === key;
            return has ? (
              <button
                key={m}
                type="button"
                onClick={() => onPick(key)}
                className={`${spaceMono.className} flex items-center justify-between rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition`}
                style={
                  isActive
                    ? {
                        borderColor: NEON,
                        color: NEON,
                        background: "rgba(255,106,0,0.12)",
                        boxShadow: `0 0 8px ${NEON}66`,
                      }
                    : {
                        borderColor: "#2a2a2a",
                        color: "#e5e5e5",
                        background: "#0f0f0f",
                      }
                }
              >
                <span>{m}</span>
                <span
                  className="text-[9px] font-normal"
                  style={{ color: isActive ? NEON : "#6a6a6a" }}
                >
                  {count}
                </span>
              </button>
            ) : (
              <span
                key={m}
                className={`${spaceMono.className} flex items-center justify-between rounded-md border border-[#1a1a1a] bg-[#0a0a0a] px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#3a3a3a]`}
              >
                {m}
              </span>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Heatmap({
  years,
  byYear,
  maxCount,
  monthKey,
  onPick,
}: {
  years: number[];
  byYear: Map<number, Map<number, number>>;
  maxCount: number;
  monthKey: string | null;
  onPick: (key: string) => void;
}) {
  return (
    <div>
      <div
        className={`${spaceMono.className} mb-2 grid items-center text-[9px] font-bold uppercase tracking-[0.22em] text-[#6a6a6a]`}
        style={{ gridTemplateColumns: "44px repeat(12, minmax(0,1fr))" }}
      >
        <span />
        {MONTH_SHORT_DE.map((m) => (
          <span key={m} className="text-center">
            {m}
          </span>
        ))}
      </div>
      <div className="space-y-1">
        {years.map((y) => {
          const yearMap = byYear.get(y) ?? new Map<number, number>();
          return (
            <div
              key={y}
              className="grid items-center"
              style={{ gridTemplateColumns: "44px repeat(12, minmax(0,1fr))" }}
            >
              <span
                className={`${spaceMono.className} text-[10px] font-bold tracking-[0.1em] text-[#a3a3a3]`}
              >
                {y}
              </span>
              {Array.from({ length: 12 }, (_, i) => {
                const monthNum = i + 1;
                const count = yearMap.get(monthNum) ?? 0;
                const key = `${y}-${String(monthNum).padStart(2, "0")}`;
                const isActive = monthKey === key;
                const intensity =
                  count === 0 ? 0 : 0.15 + 0.85 * (count / maxCount);
                if (count === 0) {
                  return (
                    <span
                      key={i}
                      title={`${MONTH_SHORT_DE[i]} ${y}: keine Aktivitäten`}
                      className="m-0.5 h-7 rounded border border-[#1a1a1a] bg-[#0a0a0a]"
                    />
                  );
                }
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onPick(key)}
                    title={`${MONTH_SHORT_DE[i]} ${y}: ${count} ${
                      count === 1 ? "Aktivität" : "Aktivitäten"
                    }`}
                    className={`${spaceMono.className} m-0.5 flex h-7 items-center justify-center rounded border text-[10px] font-bold transition hover:scale-[1.05]`}
                    style={
                      isActive
                        ? {
                            borderColor: NEON,
                            color: "#fff",
                            background: NEON,
                            boxShadow: `0 0 10px ${NEON}aa`,
                          }
                        : {
                            borderColor: "transparent",
                            color: "#fff",
                            background: `rgba(255,106,0,${intensity})`,
                          }
                    }
                  >
                    {count}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
