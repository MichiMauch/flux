"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  Camera,
  Image as ImageIcon,
  Link2,
  Mail,
  MessageCircle,
  Share2,
  X,
} from "lucide-react";
import { setActivityShare } from "@/app/share/actions";

type ShareMode = "card" | "flight";

interface Props {
  activityId: string;
  activityName: string;
  initialToken: string | null;
}

export function ShareActivityClient({
  activityId,
  activityName,
  initialToken,
}: Props) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Swipe between what gets shared: the static card or the 3D flight.
  const [mode, setMode] = useState<ShareMode>("card");
  const scrollRef = useRef<HTMLDivElement>(null);

  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function";

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setMode(idx === 1 ? "flight" : "card");
  }

  function selectMode(m: ShareMode) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: m === "flight" ? el.clientWidth : 0, behavior: "smooth" });
    setMode(m);
  }

  function previewSrc(m: ShareMode): string {
    return (
      `/api/activities/${activityId}/share-card?format=story` +
      (m === "flight" ? "&variant=flight" : "")
    );
  }

  function publicUrl(t: string): string {
    return `${window.location.origin}/share/activity/${t}`;
  }

  // Flight links carry ?view=flight so the public page opens the flythrough.
  function shareUrl(t: string): string {
    return mode === "flight" ? `${publicUrl(t)}?view=flight` : publicUrl(t);
  }

  async function ensureToken(): Promise<string> {
    if (token) return token;
    const next = await setActivityShare(activityId, true);
    if (!next) throw new Error("Link konnte nicht erstellt werden");
    setToken(next);
    return next;
  }

  async function fetchCard(): Promise<Blob> {
    const res = await fetch(previewSrc(mode), { credentials: "include" });
    if (!res.ok) throw new Error("Karte konnte nicht erstellt werden");
    return await res.blob();
  }

  function downloadBlob(blob: Blob) {
    const date = new Date().toISOString().slice(0, 10);
    const suffix = mode === "flight" ? "flug" : "karte";
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `flux-${date}-${suffix}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function run(label: string, fn: () => Promise<void>) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : `${label} fehlgeschlagen`);
      }
    });
  }

  function handleCopyLink() {
    run("Kopieren", async () => {
      const t = await ensureToken();
      await navigator.clipboard.writeText(shareUrl(t));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleWhatsapp() {
    run("WhatsApp", async () => {
      const t = await ensureToken();
      const what = mode === "flight" ? "meinen 3D-Flug" : "meine Aktivität";
      const text = encodeURIComponent(
        `Schau dir ${what} „${activityName}" an: ${shareUrl(t)}`
      );
      window.open(
        `https://wa.me/?text=${text}`,
        "_blank",
        "noopener,noreferrer"
      );
    });
  }

  function handleMail() {
    run("E-Mail", async () => {
      const t = await ensureToken();
      const what = mode === "flight" ? "3D-Flug" : "Aktivität";
      const subject = encodeURIComponent(`Flux-${what}: ${activityName}`);
      const body = encodeURIComponent(`Hier ist mein ${what}:\n${shareUrl(t)}`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    });
  }

  function handleDownload() {
    run("Herunterladen", async () => {
      const blob = await fetchCard();
      downloadBlob(blob);
    });
  }

  function handleCameraStories() {
    run("Stories", async () => {
      const blob = await fetchCard();
      downloadBlob(blob);
      setInfo(
        "PNG heruntergeladen. Öffne Camera → Story → Bild aus Galerie auswählen."
      );
    });
  }

  function handleWhatsappStatus() {
    run("Status", async () => {
      const blob = await fetchCard();
      const date = new Date().toISOString().slice(0, 10);
      const suffix = mode === "flight" ? "flug" : "karte";
      const file = new File([blob], `flux-${date}-${suffix}.png`, {
        type: "image/png",
      });
      // The card image goes into the native share sheet; the user then picks
      // WhatsApp → Status. There is no web API to post to Status directly.
      if (
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: "Flux", text: activityName });
        return;
      }
      // Desktop fallback: save the PNG and tell the user what to do with it.
      downloadBlob(blob);
      setInfo("Bild gespeichert — in WhatsApp → Status hochladen.");
    });
  }

  function handleNativeShare() {
    run("Teilen", async () => {
      const blob = await fetchCard();
      const date = new Date().toISOString().slice(0, 10);
      const suffix = mode === "flight" ? "flug" : "karte";
      const file = new File([blob], `flux-${date}-${suffix}.png`, {
        type: "image/png",
      });
      if (
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: "Flux Share-Card" });
        return;
      }
      downloadBlob(blob);
    });
  }

  function handleStopSharing() {
    run("Beenden", async () => {
      await setActivityShare(activityId, false);
      setToken(null);
    });
  }

  return (
    <div className="dark min-h-screen bg-black text-white">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[#1a1a1a] bg-black/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded p-1.5 text-[#a3a3a3] hover:bg-white/10 hover:text-white cursor-pointer"
          aria-label="Schliessen"
        >
          <X className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold uppercase tracking-[0.04em]">
          Aktivität teilen
        </h1>
      </header>

      <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
        {/* Swipe between the static card and the 3D flight */}
        <div>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl border border-[#2a2a2a] bg-[#0a0a0a] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="w-full shrink-0 snap-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc("card")}
                alt="Karte Vorschau"
                className="block h-auto w-full"
              />
            </div>
            <div className="w-full shrink-0 snap-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSrc("flight")}
                alt="3D-Flug Vorschau"
                className="block h-auto w-full"
              />
            </div>
          </div>

          {/* Tap or swipe to choose what gets shared */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => selectMode("card")}
              className={`[font-family:var(--bento-mono)] rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors cursor-pointer ${
                mode === "card"
                  ? "bg-white text-black"
                  : "bg-[#1a1a1a] text-[#a3a3a3] hover:text-white"
              }`}
            >
              Karte
            </button>
            <button
              type="button"
              onClick={() => selectMode("flight")}
              className={`[font-family:var(--bento-mono)] rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors cursor-pointer ${
                mode === "flight"
                  ? "bg-white text-black"
                  : "bg-[#1a1a1a] text-[#a3a3a3] hover:text-white"
              }`}
            >
              3D-Flug
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-[#666] [font-family:var(--bento-mono)] uppercase tracking-[0.14em]">
            ← Wischen zum Wechseln →
          </p>
        </div>

        <div>
          <div className="[font-family:var(--bento-mono)] mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]">
            {mode === "flight" ? "3D-Flug teilen" : "Karte teilen"}
          </div>
          <div className="grid grid-cols-4 gap-3">
            <ActionButton
              label="Stories"
              icon={<Camera className="h-5 w-5" />}
              onClick={handleCameraStories}
              disabled={pending}
              tint="linear-gradient(135deg,#f58529,#dd2a7b,#8134af)"
            />
            <ActionButton
              label="WhatsApp"
              icon={<MessageCircle className="h-5 w-5" />}
              onClick={handleWhatsapp}
              disabled={pending}
              tint="#25D366"
            />
            <ActionButton
              label="Status"
              icon={<ImageIcon className="h-5 w-5" />}
              onClick={handleWhatsappStatus}
              disabled={pending}
              tint="linear-gradient(135deg,#25D366,#128C7E)"
            />
            <ActionButton
              label="E-Mail"
              icon={<Mail className="h-5 w-5" />}
              onClick={handleMail}
              disabled={pending}
            />
            <ActionButton
              label={copied ? "Kopiert" : "Link"}
              icon={
                copied ? (
                  <Check className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Link2 className="h-5 w-5" />
                )
              }
              onClick={handleCopyLink}
              disabled={pending}
            />
            <ActionButton
              label="Speichern"
              icon={<Download className="h-5 w-5" />}
              onClick={handleDownload}
              disabled={pending}
            />
            {canNativeShare && (
              <ActionButton
                label="Mehr"
                icon={<Share2 className="h-5 w-5" />}
                onClick={handleNativeShare}
                disabled={pending}
              />
            )}
          </div>
          {info && <p className="mt-3 text-xs text-[#a3a3a3]">{info}</p>}
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </div>

        {token && (
          <div>
            <div className="[font-family:var(--bento-mono)] mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]">
              Öffentlicher Link
            </div>
            <div className="space-y-2 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-3">
              <code className="[font-family:var(--bento-mono)] block break-all text-xs text-white">
                {shareUrl(token)}
              </code>
              <button
                type="button"
                onClick={handleStopSharing}
                disabled={pending}
                className="[font-family:var(--bento-mono)] inline-flex items-center gap-1 rounded-md border border-red-900/50 bg-red-950/30 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-red-300 hover:bg-red-950/60 disabled:opacity-50 cursor-pointer"
              >
                Teilen beenden
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-[#666] [font-family:var(--bento-mono)] uppercase tracking-[0.14em]">
          Auswahl bestimmt, was geteilt wird · WhatsApp/E-Mail/Link senden den
          öffentlichen Link · Status öffnet die Teilen-Auswahl mit dem Bild
          (WhatsApp → Status) · Stories & Speichern laden das PNG
        </p>
      </main>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  tint,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 text-center disabled:opacity-50 cursor-pointer"
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1a1a1a] text-white"
        style={tint ? { background: tint } : undefined}
      >
        {icon}
      </span>
      <span className="[font-family:var(--bento-mono)] text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]">
        {label}
      </span>
    </button>
  );
}
