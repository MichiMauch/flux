"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  Camera,
  Image as ImageIcon,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Share2,
  X,
} from "lucide-react";
import { setActivityShare } from "@/app/share/actions";

// Was geteilt wird: eines der Story-Designs oder der 3D-Flug. Die Designs
// entsprechen dem `design`-Parameter der Share-Card-Route.
type ShareMode = "karte" | "sticker" | "rahmen" | "foto" | "video" | "flight";

// Stand des Story-Videos zum gewählten Video. Das fertige MP4 wird gleich
// geladen und hier gehalten: navigator.share() muss direkt im Tipp aufgerufen
// werden, für einen Download von mehreren MB wäre es dann zu spät.
type StoryVideo =
  | { status: "idle" | "processing" | "failed" }
  | { status: "ready"; blob: Blob };

const STORY_POLL_MS = 3000;
const STORY_TIMEOUT_MS = 12 * 60 * 1000;

const MODE_LABELS: Record<ShareMode, string> = {
  karte: "Karte",
  sticker: "Sticker",
  rahmen: "Rahmen",
  foto: "Foto",
  video: "Video",
  flight: "3D-Flug",
};

interface Props {
  activityId: string;
  activityName: string;
  initialToken: string | null;
  /** Fotos der Aktivität in Aufnahmereihenfolge; leer = kein Foto-Design. */
  photoIds: string[];
  /** Fertig umgewandelte Videos der Aktivität; leer = kein Video-Modus. */
  videoIds: string[];
}

export function ShareActivityClient({
  activityId,
  activityName,
  initialToken,
  photoIds,
  videoIds,
}: Props) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Swipe between what gets shared: one of the card designs or the 3D flight.
  const modes: ShareMode[] = [
    "karte",
    "sticker",
    "rahmen",
    ...(photoIds.length > 0 ? (["foto"] as const) : []),
    ...(videoIds.length > 0 ? (["video"] as const) : []),
    "flight",
  ];
  const [mode, setMode] = useState<ShareMode>("karte");
  // Welches Foto das Foto-Design als Hintergrund nimmt.
  const [photoId, setPhotoId] = useState<string | null>(photoIds[0] ?? null);
  // Ausschnitt des Fotos, 0–100 entlang der überstehenden Achse (50 = Mitte).
  // `photoFocus` folgt dem Regler, `photoFocusApplied` steuert die Vorschau und
  // zieht erst beim Loslassen nach — sonst rendert der Server bei jedem Pixel.
  const [photoFocus, setPhotoFocus] = useState(50);
  const [photoFocusApplied, setPhotoFocusApplied] = useState(50);
  const [videoId, setVideoId] = useState<string | null>(videoIds[0] ?? null);
  const [story, setStory] = useState<StoryVideo>({ status: "idle" });
  // Zählt hoch, sobald ein anderes Video gewählt oder die Seite verlassen
  // wird — ein noch laufendes Abfragen erkennt daran, dass es veraltet ist.
  const storyRun = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      // Ein Zähler, kein DOM-Knoten: genau der Wert beim Aufräumen ist gemeint.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      storyRun.current++;
    };
  }, []);

  function selectVideo(id: string) {
    storyRun.current++;
    setVideoId(id);
    setStory({ status: "idle" });
  }

  // Story-Video anfordern, auf das Rendern warten und das MP4 laden.
  async function createStory() {
    if (!videoId) return;
    const runId = ++storyRun.current;
    const current = () => storyRun.current === runId;
    setError(null);
    setInfo(null);
    setStory({ status: "processing" });
    try {
      const res = await fetch(`/api/videos/${videoId}/story`, { method: "POST" });
      if (!res.ok) throw new Error();
      let status = ((await res.json()) as { status: string }).status;
      const deadline = Date.now() + STORY_TIMEOUT_MS;
      while (status === "processing") {
        if (!current()) return;
        if (Date.now() > deadline) throw new Error();
        await new Promise((r) => setTimeout(r, STORY_POLL_MS));
        const meta = await fetch(`/api/videos/${videoId}?meta=1`);
        if (!meta.ok) throw new Error();
        status = ((await meta.json()) as { storyStatus: string }).storyStatus;
      }
      if (status !== "ready") throw new Error();
      // Zeitstempel gegen den Browser-Cache: nach einer Titeländerung liegt
      // unter derselben Adresse ein neu gerendertes Video.
      const file = await fetch(`/api/videos/${videoId}?story=1&t=${Date.now()}`);
      if (!file.ok) throw new Error();
      const blob = await file.blob();
      if (current()) setStory({ status: "ready", blob });
    } catch {
      if (current()) {
        setStory({ status: "failed" });
        setError("Story-Video konnte nicht erstellt werden.");
      }
    }
  }

  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function";

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setMode(modes[idx] ?? "karte");
  }

  function selectMode(m: ShareMode) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: modes.indexOf(m) * el.clientWidth, behavior: "smooth" });
    setMode(m);
  }

  // Im Video-Modus ist das die transparente Ebene mit Route und Werten, die in
  // der Vorschau über dem laufenden Video liegt.
  function previewSrc(m: ShareMode): string {
    return (
      `/api/activities/${activityId}/share-card?format=story` +
      (m === "flight" ? "&variant=flight" : `&design=${m}`) +
      (m === "foto" && photoId
        ? `&photo=${photoId}&focus=${photoFocusApplied}`
        : "")
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
    // Im Video-Modus wird das fertige Story-Video geteilt, nicht die Ebene.
    if (mode === "video") {
      if (story.status !== "ready") {
        throw new Error("Zuerst das Story-Video erstellen.");
      }
      return story.blob;
    }
    const res = await fetch(previewSrc(mode), { credentials: "include" });
    if (!res.ok) throw new Error("Karte konnte nicht erstellt werden");
    return await res.blob();
  }

  function shareFileName(): string {
    const date = new Date().toISOString().slice(0, 10);
    const suffix = mode === "flight" ? "flug" : mode;
    return `flux-${date}-${suffix}.${mode === "video" ? "mp4" : "png"}`;
  }

  function shareFile(blob: Blob): File {
    return new File([blob], shareFileName(), {
      type: mode === "video" ? "video/mp4" : "image/png",
    });
  }

  function downloadBlob(blob: Blob) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = shareFileName();
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

  // Bild in die Zwischenablage — der Weg für den Sticker: in Instagram ein
  // eigenes Foto als Story wählen und den Sticker darüber einfügen.
  function handleCopyImage() {
    run("Kopieren", async () => {
      if (mode === "video") {
        throw new Error(
          "Videos lassen sich nicht kopieren — Stories, Status oder Speichern nutzen."
        );
      }
      // Das Promise geht direkt ins ClipboardItem: Safari verlangt, dass
      // clipboard.write() noch im Klick aufgerufen wird, nicht erst nach fetch.
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": fetchCard() }),
      ]);
      setInfo(
        mode === "sticker"
          ? "Sticker kopiert — in Instagram eine Story mit eigenem Foto öffnen und einfügen."
          : "Bild kopiert."
      );
    });
  }

  function handleDownload() {
    run("Herunterladen", async () => {
      const blob = await fetchCard();
      downloadBlob(blob);
    });
  }

  /**
   * Die Karte als Datei an das Teilen-Menü des Systems übergeben. Ohne
   * Datei-Teilen (Desktop) wird sie gespeichert und `fallbackInfo` erklärt den
   * Rest. Gibt es keine Web-Schnittstelle direkt in Instagram Stories oder
   * WhatsApp Status — die von Meta gibt es nur für native Apps —, ist das der
   * kürzeste Weg: ein Tipp auf Instagram bzw. WhatsApp im Teilen-Menü.
   *
   * Bewusst ohne `text`: WhatsApp macht daraus eine Bildunterschrift, die unten
   * über der Karte liegt — genau dort, wo Name, Distanz und Zeit stehen.
   */
  async function shareCardFile(fallbackInfo: string) {
    const blob = await fetchCard();
    const file = shareFile(blob);
    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({ files: [file], title: "Flux" });
      return;
    }
    downloadBlob(blob);
    setInfo(fallbackInfo);
  }

  function handleCameraStories() {
    run("Stories", () =>
      shareCardFile(
        mode === "video"
          ? "Video gespeichert — in Instagram → Story → Video aus Galerie auswählen."
          : "Bild gespeichert — in Instagram → Story → Bild aus Galerie auswählen."
      )
    );
  }

  function handleWhatsappStatus() {
    run("Status", () =>
      shareCardFile(
        mode === "video"
          ? "Video gespeichert — in WhatsApp → Status hochladen."
          : "Bild gespeichert — in WhatsApp → Status hochladen."
      )
    );
  }

  function handleNativeShare() {
    run("Teilen", async () => {
      const blob = await fetchCard();
      const file = shareFile(blob);
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
            {modes.map((m) => (
              <div
                key={m}
                className="w-full shrink-0 snap-center"
                // Der Sticker ist transparent — das Karomuster zeigt, wo später
                // das eigene Foto durchscheint.
                style={
                  m === "sticker"
                    ? {
                        backgroundColor: "#2a2a2a",
                        backgroundImage:
                          "repeating-conic-gradient(#3a3a3a 0% 25%, transparent 0% 50%)",
                        backgroundSize: "32px 32px",
                      }
                    : undefined
                }
              >
                {m === "video" && videoId ? (
                  // Vorschau ohne Rendern: das Video läuft stumm und füllend
                  // zugeschnitten, die transparente Ebene liegt darüber — so
                  // sieht das Story-Video am Ende aus.
                  <div className="relative aspect-[9/16] w-full overflow-hidden bg-black">
                    <video
                      key={videoId}
                      src={`/api/videos/${videoId}`}
                      poster={`/api/videos/${videoId}?poster=1`}
                      muted
                      loop
                      autoPlay
                      playsInline
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewSrc(m)}
                      alt="Video Vorschau"
                      className="absolute inset-0 h-full w-full"
                    />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewSrc(m)}
                    alt={`${MODE_LABELS[m]} Vorschau`}
                    loading="lazy"
                    width={1080}
                    height={1920}
                    className="block h-auto w-full"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Tap or swipe to choose what gets shared */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => selectMode(m)}
                className={`[font-family:var(--bento-mono)] rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors cursor-pointer ${
                  mode === m
                    ? "bg-white text-black"
                    : "bg-[#1a1a1a] text-[#a3a3a3] hover:text-white"
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-[#666] [font-family:var(--bento-mono)] uppercase tracking-[0.14em]">
            ← Wischen zum Wechseln →
          </p>

          {/* Foto-Design: Hintergrundbild aus den Fotos der Aktivität wählen */}
          {mode === "foto" && (
            <div className="mt-4">
              <label className="block">
                <span className="[font-family:var(--bento-mono)] mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]">
                  Ausschnitt verschieben
                  {photoFocus !== 50 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFocus(50);
                        setPhotoFocusApplied(50);
                      }}
                      className="text-[#666] hover:text-white cursor-pointer"
                    >
                      Mitte
                    </button>
                  )}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={photoFocus}
                  onChange={(e) => setPhotoFocus(Number(e.target.value))}
                  onPointerUp={() => setPhotoFocusApplied(photoFocus)}
                  onKeyUp={() => setPhotoFocusApplied(photoFocus)}
                  onBlur={() => setPhotoFocusApplied(photoFocus)}
                  className="w-full accent-white cursor-pointer"
                  aria-label="Ausschnitt des Fotos verschieben"
                />
              </label>
            </div>
          )}
          {mode === "foto" && photoIds.length > 1 && (
            <div className="mt-4">
              <div className="[font-family:var(--bento-mono)] mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]">
                Foto wählen
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {photoIds.map((id, i) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setPhotoId(id);
                      setPhotoFocus(50);
                      setPhotoFocusApplied(50);
                    }}
                    aria-label={`Foto ${i + 1}`}
                    aria-pressed={photoId === id}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors cursor-pointer ${
                      photoId === id
                        ? "border-white"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/photos/${id}?thumb=1`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Video-Modus: Video wählen und das Story-Video erstellen */}
          {mode === "video" && (
            <div className="mt-4 space-y-3">
              {videoIds.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {videoIds.map((id, i) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectVideo(id)}
                      aria-label={`Video ${i + 1}`}
                      aria-pressed={videoId === id}
                      className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors cursor-pointer ${
                        videoId === id
                          ? "border-white"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/videos/${id}?poster=1`}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
              {story.status === "ready" ? (
                <p className="flex items-center justify-center gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-3 py-2.5 text-xs text-emerald-300">
                  <Check className="h-4 w-4" />
                  Story-Video bereit — unten teilen oder speichern
                </p>
              ) : story.status === "processing" ? (
                <p className="flex items-center justify-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2.5 text-xs text-[#a3a3a3]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Story-Video wird erstellt, das dauert bis zu einer Minute…
                </p>
              ) : (
                <button
                  type="button"
                  onClick={createStory}
                  className="[font-family:var(--bento-mono)] w-full rounded-lg bg-white px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-black hover:bg-white/90 cursor-pointer"
                >
                  {story.status === "failed"
                    ? "Nochmals versuchen"
                    : "Story-Video erstellen"}
                </button>
              )}
              <p className="text-center text-[10px] text-[#666]">
                Hochformat 1080 × 1920, höchstens 60 Sekunden, mit Ton
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="[font-family:var(--bento-mono)] mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]">
            {mode === "flight"
              ? "3D-Flug teilen"
              : mode === "video"
                ? "Video teilen"
                : "Karte teilen"}
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
              label="Kopieren"
              icon={<Copy className="h-5 w-5" />}
              onClick={handleCopyImage}
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
          öffentlichen Link · Stories und Status öffnen die Teilen-Auswahl mit
          dem Bild (Instagram → Story, WhatsApp → Status) · Kopieren legt das
          Bild in die Zwischenablage · Speichern lädt das PNG
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
