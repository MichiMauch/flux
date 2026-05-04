"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Props {
  groupId: string;
  initialUrl: string | null;
}

export function GroupCoverUploader({ groupId, initialUrl }: Props) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const displayUrl = url ? `${url}?v=${version || ""}`.replace(/\?v=$/, "") : null;

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/groups/${groupId}/cover`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Upload fehlgeschlagen");
      }
      const data = await res.json();
      setUrl(data.url);
      setVersion(Date.now());
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Cover-Bild wirklich entfernen?")) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/cover`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Löschen fehlgeschlagen");
      }
      setUrl(null);
      setVersion(Date.now());
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Löschen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {displayUrl ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-[#2a2a2a] bg-[#1a1a1a]">
          <Image
            src={displayUrl}
            alt="Cover"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center rounded-md border border-dashed border-[#2a2a2a] bg-[#1a1a1a] text-xs text-[#666]">
          Kein Cover-Bild
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white hover:border-[#4a4a4a] disabled:opacity-50"
        >
          {url ? "Cover ersetzen" : "Cover hochladen"}
        </button>
        {url ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className="inline-flex items-center rounded-md border border-[#2a2a2a] bg-black px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:border-[#4a4a4a] hover:text-white disabled:opacity-50"
          >
            Entfernen
          </button>
        ) : null}
        {busy ? (
          <span className="text-[10px] uppercase tracking-[0.14em] text-[#a3a3a3]">
            Lädt …
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
