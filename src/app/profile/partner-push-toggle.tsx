"use client";

import { useState, useTransition } from "react";
import { Users, UsersRound } from "lucide-react";
import { setPartnerPushEnabled } from "./actions";

export function PartnerPushToggle({
  initialEnabled,
  hasPartner,
}: {
  initialEnabled: boolean;
  hasPartner: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setMessage(null);
    startTransition(async () => {
      const res = await setPartnerPushEnabled(next);
      if (res.error) {
        setEnabled(!next);
        setMessage(res.error);
      }
    });
  }

  return (
    <div className="space-y-3 max-w-xl border-t border-[#3a3128] pt-4">
      <p className="text-xs text-[#d0c5ba]">
        Benachrichtigung, wenn dein Partner eine neue Aktivität hochlädt.
      </p>

      {!hasPartner && (
        <p className="text-xs text-[#9ca3af]">
          Kein Partner verknüpft.
        </p>
      )}

      {hasPartner && (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={enabled}
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            enabled
              ? "border-[#FF6A00]/60 bg-[#FF6A00]/10 text-[#FF6A00] hover:bg-[#FF6A00]/20"
              : "border-[#3a3128] bg-black/40 text-white hover:border-[#FF6A00]/60"
          }`}
        >
          {enabled ? (
            <UsersRound className="h-4 w-4" />
          ) : (
            <Users className="h-4 w-4" />
          )}
          Partner-Benachrichtigung {enabled ? "aktiv" : "deaktiviert"}
        </button>
      )}

      {message && (
        <p className="text-xs text-[#9ca3af]" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
