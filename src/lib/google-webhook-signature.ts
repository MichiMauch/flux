/**
 * Signaturprüfung für Webhook-Benachrichtigungen der Google Health API.
 *
 * Google signiert jede Benachrichtigung und legt die Signatur base64-kodiert in
 * den Header GOOGLE-HEALTH-API-SIGNATURE. Die Doku verweist auf Tink — für
 * JavaScript gibt es aber keine offizielle Tink-Bibliothek (@tink-crypto/tink-js
 * existiert nicht auf npm). Also prüfen wir mit Node-Bordmitteln.
 *
 * Das öffentliche Keyset unter der unten stehenden URL sagt, was dafür nötig
 * ist. Der protobuf-Wert jedes Schlüssels dekodiert zu:
 *
 *   params.hash_type = 3   → SHA-256
 *   params.curve     = 2   → NIST P-256
 *   params.encoding  = 2   → DER
 *   outputPrefixType = TINK
 *
 * TINK-Präfix heisst: die ersten fünf Bytes der Signatur sind 0x01 gefolgt von
 * der vier Byte grossen Key-ID (big endian), der Rest ist die eigentliche
 * DER-Signatur. Signiert wird der ROHE Body, nicht das neu serialisierte JSON —
 * ein `JSON.parse` mit anschliessendem `JSON.stringify` verändert Reihenfolge
 * und Whitespace und lässt jede Prüfung scheitern.
 *
 * Das Keyset rotiert alle 30 Tage. Es wird deshalb zwischengespeichert und neu
 * geholt, sobald eine unbekannte Key-ID auftaucht.
 */

import { createPublicKey, verify, timingSafeEqual, type KeyObject } from "node:crypto";

const KEYSET_URL =
  "https://www.gstatic.com/googlehealthapi/webhooks/webhooks_public_keyset.json";

/** Wie lange das Keyset ohne Anlass wiederverwendet wird. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Untergrenze zwischen zwei Abrufen, auch bei unbekannter Key-ID. */
const REFETCH_MIN_GAP_MS = 60 * 1000;

interface TinkKeysetJson {
  primaryKeyId?: number;
  key?: {
    keyData?: { typeUrl?: string; value?: string; keyMaterialType?: string };
    status?: string;
    keyId?: number;
    outputPrefixType?: string;
  }[];
}

let cache: { keys: Map<number, KeyObject>; fetchedAt: number } | null = null;
let lastFetchAttempt = 0;

// ── Minimaler protobuf-Leser ───────────────────────────────────────────────
// Nur so viel, wie EcdsaPublicKey braucht. Eine Abhängigkeit für vier Felder
// wäre unverhältnismässig.

function readVarint(buf: Buffer, pos: number): [number, number] {
  let result = 0;
  let shift = 0;
  while (pos < buf.length) {
    const b = buf[pos++];
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return [result >>> 0, pos];
    shift += 7;
    if (shift > 28) break;
  }
  throw new Error("Ungültiger Varint im Keyset");
}

/**
 * EcdsaPublicKey lesen. Interessieren nur die Felder 3 (x) und 4 (y); die
 * Parameter in Feld 2 werden gegen die Erwartung geprüft, damit ein stiller
 * Kurvenwechsel bei Google nicht unbemerkt durchrutscht.
 */
function parseEcdsaPublicKey(buf: Buffer): { x: Buffer; y: Buffer } {
  let pos = 0;
  let x: Buffer | null = null;
  let y: Buffer | null = null;

  while (pos < buf.length) {
    const [tag, afterTag] = readVarint(buf, pos);
    pos = afterTag;
    const field = tag >>> 3;
    const wireType = tag & 0x07;

    if (wireType === 0) {
      const [, next] = readVarint(buf, pos);
      pos = next;
      continue;
    }
    if (wireType !== 2) throw new Error(`Unerwarteter Wire-Type ${wireType}`);

    const [len, afterLen] = readVarint(buf, pos);
    pos = afterLen;
    const value = buf.subarray(pos, pos + len);
    pos += len;

    if (field === 2) {
      // EcdsaParams: hash_type=1, curve=2, encoding=3
      let p = 0;
      const params: Record<number, number> = {};
      while (p < value.length) {
        const [t, a] = readVarint(value, p);
        p = a;
        const [v, b] = readVarint(value, p);
        p = b;
        params[t >>> 3] = v;
      }
      if (params[1] !== 3 || params[2] !== 2 || params[3] !== 2) {
        throw new Error(
          `Unerwartete ECDSA-Parameter (hash=${params[1]}, curve=${params[2]}, encoding=${params[3]}) — ` +
            "erwartet SHA-256 / NIST P-256 / DER"
        );
      }
    } else if (field === 3) {
      x = Buffer.from(value);
    } else if (field === 4) {
      y = Buffer.from(value);
    }
  }

  if (!x || !y) throw new Error("x oder y fehlt im EcdsaPublicKey");
  return { x, y };
}

/**
 * Koordinate auf exakt 32 Byte bringen. Protobuf kodiert die Zahlen im
 * Zweierkomplement, weshalb Werte mit gesetztem höchsten Bit ein führendes
 * 0x00 tragen — 33 Byte statt 32.
 */
function normalizeCoordinate(b: Buffer): Buffer {
  let start = 0;
  while (start < b.length - 32 && b[start] === 0) start++;
  const trimmed = b.subarray(start);
  if (trimmed.length === 32) return Buffer.from(trimmed);
  if (trimmed.length < 32) {
    return Buffer.concat([Buffer.alloc(32 - trimmed.length), trimmed]);
  }
  throw new Error(`Koordinate ist ${trimmed.length} Byte lang, erwartet 32`);
}

function toKeyObject(x: Buffer, y: Buffer): KeyObject {
  return createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: normalizeCoordinate(x).toString("base64url"),
      y: normalizeCoordinate(y).toString("base64url"),
    },
    format: "jwk",
  });
}

async function fetchKeyset(): Promise<Map<number, KeyObject>> {
  const res = await fetch(KEYSET_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Keyset-Abruf fehlgeschlagen: HTTP ${res.status}`);
  const json = (await res.json()) as TinkKeysetJson;

  const keys = new Map<number, KeyObject>();
  for (const entry of json.key ?? []) {
    if (entry.status !== "ENABLED") continue;
    if (entry.keyData?.typeUrl !== "type.googleapis.com/google.crypto.tink.EcdsaPublicKey") {
      continue;
    }
    if (entry.outputPrefixType !== "TINK") continue;
    if (typeof entry.keyId !== "number" || !entry.keyData.value) continue;
    try {
      const { x, y } = parseEcdsaPublicKey(Buffer.from(entry.keyData.value, "base64"));
      keys.set(entry.keyId >>> 0, toKeyObject(x, y));
    } catch (e) {
      console.warn(`[google-webhook] Schlüssel ${entry.keyId} unbrauchbar:`, e);
    }
  }
  if (keys.size === 0) throw new Error("Keyset enthält keinen verwendbaren Schlüssel");
  return keys;
}

async function getKeys(forceRefresh: boolean): Promise<Map<number, KeyObject>> {
  const fresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (fresh && !forceRefresh) return cache!.keys;

  // Bei unbekannter Key-ID nicht bei jeder Anfrage neu holen — sonst wird eine
  // Flut gefälschter Signaturen zum Verstärker gegen gstatic.
  if (forceRefresh && Date.now() - lastFetchAttempt < REFETCH_MIN_GAP_MS && cache) {
    return cache.keys;
  }

  lastFetchAttempt = Date.now();
  const keys = await fetchKeyset();
  cache = { keys, fetchedAt: Date.now() };
  return keys;
}

/**
 * Prüft die Signatur einer Benachrichtigung.
 *
 * `rawBody` muss der unveränderte Text sein, den Google geschickt hat.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader) return false;

  let sig: Buffer;
  try {
    sig = Buffer.from(signatureHeader, "base64");
  } catch {
    return false;
  }
  if (sig.length < 6 || sig[0] !== 0x01) return false;

  const keyId = sig.readUInt32BE(1);
  const derSignature = sig.subarray(5);
  const message = Buffer.from(rawBody, "utf8");

  for (const forceRefresh of [false, true]) {
    let keys: Map<number, KeyObject>;
    try {
      keys = await getKeys(forceRefresh);
    } catch (e) {
      console.error("[google-webhook] Keyset nicht verfügbar:", e);
      return false;
    }
    const key = keys.get(keyId);
    if (!key) {
      // Unbekannte ID kann eine Rotation sein — einmal neu holen und nochmal
      // schauen. Danach ist die Signatur schlicht ungültig.
      if (!forceRefresh) continue;
      console.warn(`[google-webhook] Key-ID ${keyId} auch nach Rotation unbekannt`);
      return false;
    }
    try {
      return verify("sha256", message, { key, dsaEncoding: "der" }, derSignature);
    } catch (e) {
      console.warn("[google-webhook] Signaturprüfung fehlgeschlagen:", e);
      return false;
    }
  }
  return false;
}

/** Vergleicht den Authorization-Header zeitkonstant gegen das Subscriber-Secret. */
export function authorizationMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  // Google schickt den konfigurierten Wert unverändert; ein vorangestelltes
  // "Bearer " wird toleriert, falls das Secret selbst so gesetzt wurde.
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
