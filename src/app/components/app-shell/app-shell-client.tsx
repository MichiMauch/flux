"use client";

import { useCallback, useEffect, useState } from "react";
import { AppTopBar } from "./app-top-bar";
import { AppSidebar } from "./app-sidebar";
import { AppBottomNav } from "./app-bottom-nav";
import { MoreSheet } from "./more-sheet";
import { SearchPanel } from "../search/search-panel";

const STORAGE_KEY = "flux.sidebar";

interface AppShellClientProps {
  userName: string;
  userEmail: string;
  portraitUrl: string | null;
  initials: string;
  logoutAction: () => void;
  children: React.ReactNode;
}

export function AppShellClient({
  userName,
  userEmail,
  portraitUrl,
  initials,
  logoutAction,
  children,
}: AppShellClientProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "collapsed") setCollapsed(true);
    } catch {}
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "expanded");
      } catch {}
      return next;
    });
  }, []);

  const mainPadding = collapsed ? "lg:pl-20" : "lg:pl-60";

  return (
    <div className="min-h-full">
      <AppTopBar
        userName={userName}
        userEmail={userEmail}
        portraitUrl={portraitUrl}
        initials={initials}
        logoutAction={logoutAction}
        onToggleSidebar={toggleSidebar}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <AppSidebar collapsed={collapsed} />
      <div
        className={`flex min-h-[calc(100dvh-3.5rem)] flex-col transition-[padding] duration-200 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 ${mainPadding}`}
      >
        {children}
      </div>
      <AppBottomNav onOpenMore={() => setMoreOpen(true)} />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        logoutAction={logoutAction}
      />
      <SearchPanel
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  );
}
