"use client";

import { useState, useTransition } from "react";
import { Check, Link2, Unlink } from "lucide-react";
import { disconnectGoogle } from "./actions";

const NEON = "#FF6A00";

export interface ConnectionState {
  polar: boolean;
  google: boolean;
  withings: boolean;
  googleConnectedAt: string | null;
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 rounded-full"
      style={{
        backgroundColor: connected ? "#4ade80" : "#4b5563",
        boxShadow: connected ? "0 0 8px #4ade8088" : "none",
      }}
    />
  );
}

function Row({
  name,
  detail,
  connected,
  children,
}: {
  name: string;
  detail: string;
  connected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[#3a3128] py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <StatusDot connected={connected} />
          <span className="text-sm font-semibold text-white">{name}</span>
        </div>
        <p className="mt-0.5 text-xs text-[#9ca3af]">{detail}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const linkClass =
  "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors cursor-pointer";

export function Connections({ state }: { state: ConnectionState }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleDisconnect() {
    setConfirming(false);
    setMessage(null);
    startTransition(async () => {
      const res = await disconnectGoogle();
      setMessage(res.error ?? "Google getrennt");
    });
  }

  return (
    <div className="max-w-xl space-y-1">
      <Row
        name="Polar"
        detail={state.polar ? "Verbunden" : "Nicht verbunden"}
        connected={state.polar}
      >
        <a
          href="/api/polar/authorize"
          className={linkClass}
          style={{ borderColor: "#3a3128", color: "#d0c5ba" }}
        >
          <Link2 className="h-3 w-3" />
          {state.polar ? "Neu verbinden" : "Verbinden"}
        </a>
      </Row>

      <Row
        name="Google Health"
        detail={
          state.google
            ? state.googleConnectedAt
              ? `Verbunden · Aktivitäten ab ${state.googleConnectedAt}`
              : "Verbunden"
            : "Pixel Watch — nicht verbunden"
        }
        connected={state.google}
      >
        {state.google ? (
          confirming ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDisconnect}
                disabled={pending}
                className={`${linkClass} disabled:opacity-50`}
                style={{ borderColor: "#7f1d1d", color: "#fca5a5" }}
              >
                <Unlink className="h-3 w-3" />
                Wirklich trennen
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-[10px] uppercase tracking-[0.14em] text-[#9ca3af] hover:text-white cursor-pointer"
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className={linkClass}
              style={{ borderColor: "#3a3128", color: "#d0c5ba" }}
            >
              <Unlink className="h-3 w-3" />
              Trennen
            </button>
          )
        ) : (
          <a
            href="/api/google/authorize"
            className={linkClass}
            style={{
              borderColor: NEON,
              color: NEON,
              background: `${NEON}10`,
            }}
          >
            <Link2 className="h-3 w-3" />
            Verbinden
          </a>
        )}
      </Row>

      <Row
        name="Withings"
        detail={state.withings ? "Verbunden — Gewicht" : "Nicht verbunden"}
        connected={state.withings}
      >
        <a
          href="/api/withings/authorize"
          className={linkClass}
          style={{ borderColor: "#3a3128", color: "#d0c5ba" }}
        >
          <Link2 className="h-3 w-3" />
          {state.withings ? "Neu verbinden" : "Verbinden"}
        </a>
      </Row>

      {message && (
        <p className="flex items-center gap-1.5 pt-2 text-xs text-[#9ca3af]">
          <Check className="h-3 w-3" />
          {message}
        </p>
      )}

      {state.google && (
        <p className="pt-2 text-xs text-[#9ca3af]">
          Es werden nur Aktivitäten übernommen, die du auf der Uhr gestartet
          hast. Was das Handy nebenbei aufzeichnet, bleibt draussen.
        </p>
      )}
    </div>
  );
}
