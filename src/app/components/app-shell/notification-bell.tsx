"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  url: string;
  kind: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationBellProps {
  initialItems: NotificationItem[];
  initialUnread: number;
}

const REFRESH_MS = 30_000;

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSec < 30) return "gerade eben";
  if (diffSec < 90) return "vor 1 Min.";
  if (diffSec < 3600) return `vor ${Math.round(diffSec / 60)} Min.`;
  if (diffSec < 7200) return "vor 1 Std.";
  if (diffSec < 86400) return `vor ${Math.round(diffSec / 3600)} Std.`;
  if (diffSec < 172800) return "gestern";
  if (diffSec < 7 * 86400) return `vor ${Math.round(diffSec / 86400)} Tagen`;
  return d.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function NotificationBell({
  initialItems,
  initialUnread,
}: NotificationBellProps) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: NotificationItem[];
        unreadCount: number;
      };
      if (!mountedRef.current) return;
      setItems(data.items);
      setUnread(data.unreadCount);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const i = window.setInterval(refresh, REFRESH_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      mountedRef.current = false;
      window.clearInterval(i);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setUnread(0);
    setItems((prev) =>
      prev.map((n) =>
        n.readAt ? n : { ...n, readAt: new Date().toISOString() }
      )
    );
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      // silent
    }
  }, []);

  const markRead = useCallback(
    (id: string) => {
      const target = items.find((n) => n.id === id);
      if (!target || target.readAt) return;
      setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
      setUnread((prev) => Math.max(0, prev - 1));
      fetch(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {});
    },
    [items]
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="relative flex h-11 w-11 items-center justify-center rounded-md text-foreground/80 hover:bg-surface hover:text-foreground focus:outline-none"
        aria-label="Mitteilungen"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span
            className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[color:var(--brand)] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background"
            aria-label={`${unread} ungelesen`}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="!w-80 max-w-[calc(100vw-1rem)] p-0"
      >
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-sm font-semibold">Mitteilungen</span>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-foreground/70 hover:text-foreground"
            >
              Alle gelesen
            </button>
          ) : (
            <span className="text-xs text-foreground/40">Keine ungelesen</span>
          )}
        </div>
        <div className="border-t border-border" />
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-foreground/60">
            Noch keine Mitteilungen.
          </div>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto py-1">
            {items.map((n) => {
              const isUnread = n.readAt == null;
              return (
                <li key={n.id}>
                  <Link
                    href={n.url}
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                    }}
                    className={`flex gap-2 px-3 py-2.5 text-sm hover:bg-surface ${
                      isUnread ? "bg-[color:var(--brand)]/[0.06]" : ""
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        isUnread
                          ? "bg-[color:var(--brand)]"
                          : "bg-transparent"
                      }`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {n.title}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-xs text-foreground/70">
                        {n.body}
                      </span>
                      <span className="mt-1 block text-[10px] uppercase tracking-wide text-foreground/50">
                        {formatRelative(n.createdAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
