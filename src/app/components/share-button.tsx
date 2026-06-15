"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Link2,
  Loader2,
  RotateCw,
  Share2,
  X,
} from "lucide-react";
import {
  rotateActivityShare,
  rotateTourShare,
  setActivityShare,
  setTourShare,
} from "@/app/share/actions";

type Kind = "activity" | "tour";

interface ShareButtonProps {
  kind: Kind;
  id: string;
  initialToken: string | null;
}

interface SharePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: Kind;
  id: string;
  initialToken: string | null;
}

function shareUrl(kind: Kind, token: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/share/${kind}/${token}`;
}

export function SharePanel({
  open,
  onOpenChange,
  kind,
  id,
  initialToken,
}: SharePanelProps) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardPending, setCardPending] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  function handleToggle(enable: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const fn = kind === "activity" ? setActivityShare : setTourShare;
        const next = await fn(id, enable);
        setToken(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fehler");
      }
    });
  }

  function handleRotate() {
    setError(null);
    startTransition(async () => {
      try {
        const fn = kind === "activity" ? rotateActivityShare : rotateTourShare;
        const next = await fn(id);
        setToken(next);
        setCopied(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fehler");
      }
    });
  }

  async function handleCopy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(shareUrl(kind, token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Kopieren fehlgeschlagen");
    }
  }

  async function handleShareCard() {
    setCardPending(true);
    setCardError(null);
    try {
      const res = await fetch(
        `/api/activities/${id}/share-card?format=square`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Share-Card konnte nicht erstellt werden");
      const blob = await res.blob();
      const date = new Date().toISOString().slice(0, 10);
      const file = new File([blob], `flux-${date}-share-card.png`, {
        type: "image/png",
      });

      if (canNativeShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Flux Share-Card" });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setCardError(
        e instanceof Error ? e.message : "Share-Card konnte nicht erstellt werden"
      );
    } finally {
      setCardPending(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Schliessen"
        className="fixed inset-0 z-40 bg-black/60"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-50 w-[min(360px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]">
            Teilen
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Schliessen"
            className="rounded p-1 text-[#a3a3a3] hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3] mb-2">
          Öffentlicher Link
        </div>

        {token ? (
          <>
            <div className="flex items-center gap-1 rounded-md border border-[#2a2a2a] bg-black p-1.5">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-[#666]" />
              <input
                type="text"
                readOnly
                value={shareUrl(kind, token)}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 bg-transparent text-xs text-white focus:outline-none [font-family:var(--bento-mono)]"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 rounded p-1 text-[#a3a3a3] hover:bg-white/10 hover:text-white"
                aria-label="Link kopieren"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleRotate}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:border-[#4a4a4a] hover:text-white disabled:opacity-50 [font-family:var(--bento-mono)]"
              >
                <RotateCw className="h-3 w-3" />
                Neuer Link
              </button>
              <button
                type="button"
                onClick={() => handleToggle(false)}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md border border-red-900/50 bg-red-950/30 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-red-300 hover:bg-red-950/60 disabled:opacity-50 [font-family:var(--bento-mono)]"
              >
                Teilen beenden
              </button>
            </div>

            <p className="mt-3 text-[10px] leading-snug text-[#a3a3a3]">
              Wer den Link hat, kann die {kind === "activity" ? "Aktivität" : "Tour"} ohne Login ansehen.
            </p>
          </>
        ) : (
          <>
            <p className="mb-3 text-xs leading-snug text-[#a3a3a3]">
              Erstelle einen öffentlichen Link, mit dem auch Personen ohne Flux-Account diese {kind === "activity" ? "Aktivität" : "Tour"} ansehen können.
            </p>
            <button
              type="button"
              onClick={() => handleToggle(true)}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-black hover:bg-[#f5f5f5] disabled:opacity-50 [font-family:var(--bento-mono)]"
            >
              <Share2 className="h-3 w-3" />
              Link erstellen
            </button>
          </>
        )}

        {error && <p className="mt-2 text-[10px] text-red-400">{error}</p>}

        {kind === "activity" && (
          <>
            <div className="my-3 h-px bg-[#2a2a2a]" />
            <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3] mb-2">
              Als Bild teilen
            </div>
            <button
              type="button"
              onClick={handleShareCard}
              disabled={cardPending}
              className="inline-flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:border-[#4a4a4a] hover:text-white disabled:opacity-50 [font-family:var(--bento-mono)]"
            >
              {cardPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : canNativeShare ? (
                <ImageIcon className="h-3 w-3" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              {canNativeShare ? "Karte teilen" : "Karte herunterladen"}
            </button>
            <p className="mt-2 text-[10px] leading-snug text-[#a3a3a3]">
              Bento-Card als PNG (1080 × 1080).
            </p>
            {cardError && (
              <p className="mt-2 text-[10px] text-red-400">{cardError}</p>
            )}
          </>
        )}
      </div>
    </>
  );
}

export function ShareButton({ kind, id, initialToken }: ShareButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a] [font-family:var(--bento-mono)]"
        aria-haspopup="dialog"
      >
        <Share2 className="h-3.5 w-3.5" />
        Teilen
      </button>
      <SharePanel
        open={open}
        onOpenChange={setOpen}
        kind={kind}
        id={id}
        initialToken={initialToken}
      />
    </>
  );
}
