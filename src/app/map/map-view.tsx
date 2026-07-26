"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { sportColor } from "@/lib/sport-colors";
import { activityTypeLabel } from "@/lib/activity-types";
import type { MapRoute } from "@/app/api/map/routes/route";

const ActivityMapCanvas = dynamic(() => import("./activity-map-canvas"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; routes: MapRoute[] };

export function MapView() {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const [activeSports, setActiveSports] = useState<Set<string> | null>(null);
  const [year, setYear] = useState<"all" | number>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/map/routes");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { routes: MapRoute[] };
        if (!cancelled) setState({ status: "ready", routes: data.routes });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allRoutes = useMemo(
    () => (state.status === "ready" ? state.routes : []),
    [state],
  );

  const sports = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRoutes) set.add(r.type);
    return Array.from(set).sort((a, b) =>
      activityTypeLabel(a).localeCompare(activityTypeLabel(b), "de"),
    );
  }, [allRoutes]);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const r of allRoutes) set.add(new Date(r.startTime).getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [allRoutes]);

  // Default: all sports active once we know the set.
  useEffect(() => {
    if (state.status === "ready" && activeSports === null) {
      setActiveSports(new Set(sports));
    }
  }, [state.status, sports, activeSports]);

  const filtered = useMemo(() => {
    if (activeSports === null) return allRoutes;
    return allRoutes.filter((r) => {
      if (!activeSports.has(r.type)) return false;
      if (year !== "all" && new Date(r.startTime).getFullYear() !== year)
        return false;
      return true;
    });
  }, [allRoutes, activeSports, year]);

  function toggleSport(type: string) {
    setActiveSports((prev) => {
      const next = new Set(prev ?? sports);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  if (state.status === "error") {
    return (
      <div className="flex h-[60vh] items-center justify-center rounded-lg border border-[#2a2a2a] text-sm text-[#a3a3a3]">
        Karte konnte nicht geladen werden.
      </div>
    );
  }

  if (state.status === "loading") {
    return <MapSkeleton />;
  }

  if (allRoutes.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center rounded-lg border border-[#2a2a2a] text-center text-sm text-[#a3a3a3]">
        Noch keine Aktivitäten mit GPS-Track vorhanden.
      </div>
    );
  }

  const allActive = activeSports === null || activeSports.size === sports.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {sports.map((type, idx) => {
          const active = activeSports === null || activeSports.has(type);
          const color = sportColor(type, idx);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleSport(type)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-[#4a4a4a] bg-[#1a1a1a] text-white"
                  : "border-[#2a2a2a] bg-transparent text-[#5a5a5a]"
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: active ? color : "transparent",
                  border: active ? "none" : `1px solid ${color}`,
                }}
              />
              {activityTypeLabel(type)}
            </button>
          );
        })}

        {!allActive && (
          <button
            type="button"
            onClick={() => setActiveSports(new Set(sports))}
            className="cursor-pointer rounded-full px-2 py-1 text-xs text-[#a3a3a3] underline decoration-dotted underline-offset-2 hover:text-white"
          >
            alle
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3]">
            Jahr
          </label>
          <select
            value={String(year)}
            onChange={(e) =>
              setYear(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="cursor-pointer rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-2 py-1 text-xs text-white"
          >
            <option value="all">Alle Jahre</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="h-[calc(100vh-260px)] min-h-[420px] w-full overflow-hidden rounded-lg border border-[#2a2a2a]">
        <ActivityMapCanvas routes={filtered} />
      </div>

      <div className="text-[10px] uppercase tracking-[0.14em] text-[#5a5a5a]">
        {filtered.length} von {allRoutes.length} Aktivitäten · mehrfach
        gelaufene Wege leuchten heller
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="h-[calc(100vh-260px)] min-h-[420px] w-full animate-pulse rounded-lg border border-[#2a2a2a] bg-[#0a0a0a]" />
  );
}
