"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "flux.pwa.installDismissedAt";
const DISMISS_DAYS = 30;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isRecentlyDismissed() {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || isRecentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setDeferred(null);
      setVisible(false);
      try {
        window.localStorage.removeItem(DISMISS_KEY);
      } catch {}
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || !deferred) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
    setDeferred(null);
  };

  const install = async () => {
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "dismissed") {
        try {
          window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {}
      }
    } catch {}
    setVisible(false);
    setDeferred(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Flux installieren"
      className="fixed inset-x-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand)]/15 text-[color:var(--brand)]">
        <Download className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">Flux installieren</p>
        <p className="text-xs text-muted-foreground">Wie eine native App auf dem Homescreen.</p>
      </div>
      <button
        type="button"
        onClick={install}
        className="rounded-lg bg-[color:var(--brand)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
      >
        Installieren
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Schliessen"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
