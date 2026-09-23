"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { AppTopBar } from "./app-top-bar";
import { AppSidebar } from "./app-sidebar";
import { AppBottomNav } from "./app-bottom-nav";
import { MoreSheet } from "./more-sheet";
import { SearchPanel } from "../search/search-panel";
import type { NotificationItem } from "./notification-bell";

const STORAGE_KEY = "flux.sidebar";
// Eigenes Event, weil "storage" nur in anderen Tabs feuert.
const SIDEBAR_EVENT = "flux:sidebar";

// Der eingeklappte Zustand lebt in localStorage; die Komponente liest ihn als
// externen Store. Beim Server-Render und bei der Hydration gilt "offen".
// Ist localStorage gesperrt (privates Fenster), bleibt der Zustand im Speicher.
let memoryCollapsed = false;

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "collapsed";
  } catch {
    return memoryCollapsed;
  }
}

function writeSidebarCollapsed(collapsed: boolean) {
  memoryCollapsed = collapsed;
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  } catch {}
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
}

function subscribeSidebar(onChange: () => void) {
  window.addEventListener(SIDEBAR_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SIDEBAR_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

interface AppShellClientProps {
  userName: string;
  userEmail: string;
  portraitUrl: string | null;
  initials: string;
  logoutAction: () => void;
  initialNotifications: NotificationItem[];
  initialUnreadNotifications: number;
  children: React.ReactNode;
}

export function AppShellClient({
  userName,
  userEmail,
  portraitUrl,
  initials,
  logoutAction,
  initialNotifications,
  initialUnreadNotifications,
  children,
}: AppShellClientProps) {
  const collapsed = useSyncExternalStore(
    subscribeSidebar,
    readSidebarCollapsed,
    () => false
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    writeSidebarCollapsed(!readSidebarCollapsed());
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
        initialNotifications={initialNotifications}
        initialUnreadNotifications={initialUnreadNotifications}
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
