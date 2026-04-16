"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface HoverState {
  hoverIdx: number | null;
  setHoverIdx: (i: number | null) => void;
}

const HoverContext = createContext<HoverState | null>(null);

export function HoverProvider({ children }: { children: ReactNode }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  return (
    <HoverContext.Provider value={{ hoverIdx, setHoverIdx }}>
      {children}
    </HoverContext.Provider>
  );
}

export function useHover(): HoverState {
  const ctx = useContext(HoverContext);
  if (!ctx) return { hoverIdx: null, setHoverIdx: () => {} };
  return ctx;
}
