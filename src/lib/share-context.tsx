"use client";

import { createContext, useContext, type ReactNode } from "react";

const ShareTokenContext = createContext<string | null>(null);

export function ShareTokenProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  return (
    <ShareTokenContext.Provider value={token}>
      {children}
    </ShareTokenContext.Provider>
  );
}

export function useShareToken(): string | null {
  return useContext(ShareTokenContext);
}

export function appendShareToken(url: string, token: string | null): string {
  if (!token) return url;
  return url + (url.includes("?") ? "&" : "?") + "share=" + encodeURIComponent(token);
}
