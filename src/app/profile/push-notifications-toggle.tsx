"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";

type Status =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "unconfigured" }
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on" };

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export function PushNotificationsToggle() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setStatus({ kind: "unsupported" });
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setStatus({ kind: "denied" });
        return;
      }

      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus({ kind: existing ? "on" : "off" });
      } catch (err) {
        console.error("[push] SW registration failed", err);
        if (!cancelled) setStatus({ kind: "unsupported" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const keyRes = await fetch("/api/push/vapid-public-key");
      if (keyRes.status === 503) {
        setStatus({ kind: "unconfigured" });
        return;
      }
      if (!keyRes.ok) throw new Error("VAPID-Key konnte nicht geladen werden");
      const { publicKey } = (await keyRes.json()) as { publicKey: string };

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus({ kind: permission === "denied" ? "denied" : "off" });
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
      });
      const json = sub.toJSON();

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("Server lehnte Subscription ab");

      setStatus({ kind: "on" });
      setMessage("Benachrichtigungen aktiviert.");
    } catch (err) {
      console.error("[push] enable failed", err);
      setMessage(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus({ kind: "off" });
      setMessage("Benachrichtigungen deaktiviert.");
    } catch (err) {
      console.error("[push] disable failed", err);
      setMessage(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) throw new Error("Test fehlgeschlagen");
      setMessage("Test-Benachrichtigung gesendet.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "inline-flex items-center gap-2 rounded-md border border-[#3a3128] bg-black/40 px-3 py-2 text-sm text-white hover:border-[#FF6A00]/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
  const btnPrimary =
    "inline-flex items-center gap-2 rounded-md border border-[#FF6A00]/60 bg-[#FF6A00]/10 px-3 py-2 text-sm text-[#FF6A00] hover:bg-[#FF6A00]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

  return (
    <div className="space-y-3 max-w-xl">
      <p className="text-xs text-[#d0c5ba]">
        Erhalte Push-Benachrichtigungen, wenn eine neue Aktivität synchronisiert
        wurde, eine Trophy freigeschaltet wurde oder das Tages-Schrittziel
        erreicht ist.
      </p>

      {status.kind === "loading" && (
        <p className="text-sm text-[#9ca3af]">Prüfe Status…</p>
      )}

      {status.kind === "unsupported" && (
        <p className="text-sm text-[#9ca3af]">
          Dieser Browser unterstützt keine Web-Push-Benachrichtigungen.
        </p>
      )}

      {status.kind === "unconfigured" && (
        <p className="text-sm text-[#FF6A00]">
          Push ist auf dem Server nicht konfiguriert (VAPID-Keys fehlen).
        </p>
      )}

      {status.kind === "denied" && (
        <p className="text-sm text-[#FF6A00]">
          Benachrichtigungen wurden im Browser blockiert. Erlaube sie in den
          Website-Einstellungen und lade die Seite neu.
        </p>
      )}

      {status.kind === "off" && (
        <button
          type="button"
          disabled={busy}
          onClick={enable}
          className={btnPrimary}
        >
          <Bell className="h-4 w-4" />
          Benachrichtigungen aktivieren
        </button>
      )}

      {status.kind === "on" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={test} className={btn}>
            <Send className="h-4 w-4" />
            Test senden
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={disable}
            className={btn}
          >
            <BellOff className="h-4 w-4" />
            Deaktivieren
          </button>
        </div>
      )}

      {message && (
        <p className="text-xs text-[#9ca3af]" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
