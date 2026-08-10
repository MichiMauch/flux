"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * A highlighted stretch of the route, addressed by original routeData indices.
 * `key` identifies who set it (e.g. "km:3", "climb:up:2") so lists can render
 * their own row as active without knowing about the other lists.
 */
export interface RangeSelection {
  key: string;
  range: [number, number];
}

interface HoverState {
  hoverIdx: number | null;
  setHoverIdx: (i: number | null) => void;
  selection: RangeSelection | null;
  setSelection: (s: RangeSelection | null) => void;
  /** Select, or clear when the same key is already selected. */
  toggleSelection: (s: RangeSelection) => void;
}

const HoverContext = createContext<HoverState | null>(null);

const NOOP_STATE: HoverState = {
  hoverIdx: null,
  setHoverIdx: () => {},
  selection: null,
  setSelection: () => {},
  toggleSelection: () => {},
};

export function HoverProvider({ children }: { children: ReactNode }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [selection, setSelection] = useState<RangeSelection | null>(null);

  const toggleSelection = useCallback((s: RangeSelection) => {
    setSelection((prev) => (prev?.key === s.key ? null : s));
  }, []);

  const value = useMemo(
    () => ({
      hoverIdx,
      setHoverIdx,
      selection,
      setSelection,
      toggleSelection,
    }),
    [hoverIdx, selection, toggleSelection],
  );

  return (
    <HoverContext.Provider value={value}>{children}</HoverContext.Provider>
  );
}

export function useHover(): HoverState {
  return useContext(HoverContext) ?? NOOP_STATE;
}

/** Kilometre index behind a selection key like "km:3", else null. */
export function kmFromSelectionKey(key: string | undefined): number | null {
  if (!key?.startsWith("km:")) return null;
  const n = Number(key.slice(3));
  return Number.isFinite(n) ? n : null;
}
