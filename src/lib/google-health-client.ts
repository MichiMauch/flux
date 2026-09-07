/**
 * Client für die Google Health API (health.googleapis.com/v4).
 *
 * Nachfolger der Fitbit Web API und die Quelle für alles, was die Pixel Watch
 * aufzeichnet. Aufgebaut wie polar-client.ts, mit drei Eigenheiten, die beim
 * Vorabtest am 2026-09-07 herausgekommen sind und in der Doku nicht stehen:
 *
 *  1. Zeitfilter gibt es nur für exercise, steps und die daily-Typen. sleep und
 *     heart-rate lehnen JEDEN Filter ab ("Member is not supported for
 *     filtering") — dort muss die Liste durchgeblättert werden.
 *  2. Der filterbare Member heisst civil_start_time und will ein ZIVILES Datum
 *     ohne Z. Mit start_time oder mit Z antwortet die API 400.
 *  3. dailyRollUp erwartet ein verschachteltes CivilTimeInterval
 *     ({date:{...},time:{...}}), nicht ein flaches {year,month,day}.
 */

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const API = "https://health.googleapis.com/v4";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Access-Token wird so viele Sekunden vor Ablauf schon erneuert. */
const REFRESH_SKEW_SEC = 120;

export const GOOGLE_HEALTH_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  // Ohne diesen Scope liefert exportExerciseTcx 403 und es gibt keine Routen.
  "https://www.googleapis.com/auth/googlehealth.location.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.profile.readonly",
];

/**
 * Token abgelehnt — Zugriff widerrufen oder Refresh-Token tot. Kein erneuter
 * Versuch hilft, der User muss neu verbinden. Gegenstück zu PolarAuthError,
 * damit Aufrufer beide Quellen gleich behandeln können.
 */
export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

// ── OAuth ──────────────────────────────────────────────────────────────────

export function getAuthorizationUrl(callbackUrl: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!,
    redirect_uri: callbackUrl,
    response_type: "code",
    // Ohne access_type=offline UND prompt=consent gibt Google kein
    // Refresh-Token heraus — bei der zweiten Verbindung desselben Kontos
    // kommt sonst nur ein Access-Token und der Cron steht nach einer Stunde.
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_HEALTH_SCOPES.join(" "),
    state,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

export async function exchangeToken(
  code: string,
  callbackUrl: string
): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET!,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${JSON.stringify(data)}`);
  }
  return data as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    // invalid_grant heisst: Refresh-Token widerrufen oder abgelaufen. Das
    // passiert auch, wenn der Consent-Screen noch auf "Testing" steht — dort
    // sterben Refresh-Tokens nach 7 Tagen.
    if (data?.error === "invalid_grant") {
      throw new GoogleAuthError(
        `Refresh-Token abgelehnt: ${data.error_description ?? data.error}`
      );
    }
    throw new Error(`Google token refresh failed: ${JSON.stringify(data)}`);
  }
  return data as TokenResponse;
}

/**
 * Gültiges Access-Token für einen User, bei Bedarf erneuert und persistiert.
 *
 * Google gibt beim Refresh normalerweise kein neues Refresh-Token zurück; das
 * alte bleibt gültig und wird nur überschrieben, wenn doch eins mitkommt.
 */
export async function getValidAccessToken(
  user: Pick<
    typeof users.$inferSelect,
    "id" | "googleAccessToken" | "googleRefreshToken" | "googleTokenExpiry"
  >
): Promise<string> {
  if (!user.googleRefreshToken) {
    throw new GoogleAuthError("Google nicht verbunden");
  }

  const expiry = user.googleTokenExpiry?.getTime() ?? 0;
  const stillValid =
    user.googleAccessToken && expiry - REFRESH_SKEW_SEC * 1000 > Date.now();
  if (stillValid) return user.googleAccessToken!;

  const fresh = await refreshAccessToken(user.googleRefreshToken);
  await db
    .update(users)
    .set({
      googleAccessToken: fresh.access_token,
      googleTokenExpiry: new Date(Date.now() + fresh.expires_in * 1000),
      ...(fresh.refresh_token ? { googleRefreshToken: fresh.refresh_token } : {}),
    })
    .where(eq(users.id, user.id));
  return fresh.access_token;
}

/**
 * Die Google-interne Nutzernummer ermitteln.
 *
 * Sie steckt im Ressourcennamen jedes Datenpunkts
 * ("users/6415286439906300120/dataTypes/..."). Gebraucht wird sie einzig, um
 * eine Webhook-Notification einem flux-User zuzuordnen — im Payload steht nur
 * diese healthUserId und sonst nichts Identifizierendes.
 *
 * Mehrere Wege, weil ein frisch verbundenes Konto noch keine Aktivität haben
 * muss. Findet keiner etwas, bleibt das Feld leer und der Webhook lässt sich
 * später nachziehen; der reguläre Sync funktioniert auch ohne.
 */
export async function fetchHealthUserId(token: string): Promise<string | null> {
  for (const dataType of ["steps", "exercise", "sleep"]) {
    try {
      const body = await apiGet<ListResponse<{ name?: string }>>(
        token,
        `/users/me/dataTypes/${dataType}/dataPoints?pageSize=1`
      );
      const name = body.dataPoints?.[0]?.name;
      const match = name?.match(/^users\/([^/]+)\//);
      if (match) return match[1];
    } catch {
      // Nächsten Typ versuchen.
    }
  }
  return null;
}

// ── HTTP ───────────────────────────────────────────────────────────────────

async function apiGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    throw new GoogleAuthError(`Google lehnt den Token ab (HTTP ${res.status})`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Google ${path} failed (HTTP ${res.status}): ${JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data as T;
}

async function apiPost<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    throw new GoogleAuthError(`Google lehnt den Token ab (HTTP ${res.status})`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Google ${path} failed (HTTP ${res.status}): ${JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data as T;
}

// ── Typen ──────────────────────────────────────────────────────────────────

export interface GoogleDataSource {
  recordingMethod?: string;
  platform?: string;
  device?: { formFactor?: string; displayName?: string };
}

export interface GoogleInterval {
  startTime?: string;
  endTime?: string;
  startUtcOffset?: string;
  endUtcOffset?: string;
}

export interface GoogleExercise {
  name: string;
  dataSource?: GoogleDataSource;
  exercise?: {
    interval?: GoogleInterval;
    exerciseType?: string;
    displayName?: string;
    activeDuration?: string;
    exerciseMetadata?: { hasGps?: boolean };
    metricsSummary?: {
      caloriesKcal?: number;
      distanceMillimeters?: string | number;
      steps?: string | number;
      averageHeartRateBeatsPerMinute?: string | number;
      elevationGainMillimeters?: string | number;
      activeZoneMinutes?: string | number;
      averagePaceSecondsPerMeter?: number;
      heartRateZoneDurations?: Record<string, string>;
    };
  };
}

export interface GoogleSleep {
  name: string;
  dataSource?: GoogleDataSource;
  sleep?: {
    interval?: GoogleInterval;
    type?: string;
    stages?: { startTime: string; endTime: string; type: string }[];
  };
}

interface ListResponse<T> {
  dataPoints?: T[];
  nextPageToken?: string;
}

// ── Zeitformate ────────────────────────────────────────────────────────────

/** Ziviles Datum ohne Z, wie es der Filter verlangt: 2026-09-07T00:00:00 */
export function civilFilterTime(d: Date): string {
  return d.toISOString().slice(0, 19);
}

/** CivilDateTime für dailyRollUp. */
function civilDateTime(d: Date) {
  return {
    date: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() },
    time: { hours: 0, minutes: 0 },
  };
}

// ── Importregel ────────────────────────────────────────────────────────────

/**
 * Darf diese Aktivität nach flux? Gibt den Ablehnungsgrund zurück, oder null.
 *
 * Mit dem User abgestimmt und an echten Daten geprüft:
 *
 *  1. Nur was die UHR aufgezeichnet hat. Google Health sammelt auch, was das
 *     Handy nebenbei mitbekommt — ein solcher Eintrag trug formFactor PHONE
 *     ohne Gerätenamen, die Uhr trägt WATCH und "Pixel Watch 5". Ohne diese
 *     Regel landen automatisch erkannte Handy-Spaziergänge als Trainings in
 *     der Liste und zählen in Wochenstatistik, Form und Trophäen mit.
 *  2. Nur bewusst gestartet (ACTIVELY_MEASURED). Ob von der Uhr SELBST
 *     erkannte Aktivitäten einen anderen Wert tragen, liess sich mit den
 *     bisher gesehenen Datenpunkten nicht klären — deshalb wird jede
 *     Ablehnung mit Grund geloggt, damit die Regel nachjustiert werden kann.
 *  3. Nichts vor dem Stichtag. GPS ist bewusst KEIN Kriterium: Yoga von der
 *     Uhr hat nie welches und soll trotzdem rein.
 */
export function rejectImportReason(
  p: GoogleExercise,
  since: Date | null
): string | null {
  const ds = p.dataSource;
  const form = ds?.device?.formFactor;
  if (form !== "WATCH") {
    const name = ds?.device?.displayName ? `, ${ds.device.displayName}` : "";
    return `nicht von der Uhr (formFactor=${form ?? "unbekannt"}${name})`;
  }
  if (ds?.recordingMethod !== "ACTIVELY_MEASURED") {
    return `nicht bewusst gestartet (recordingMethod=${ds?.recordingMethod ?? "unbekannt"})`;
  }
  const start = p.exercise?.interval?.startTime;
  if (!start) return "kein Startzeitpunkt";
  if (since && new Date(start) < since) return `vor dem Stichtag (${start.slice(0, 10)})`;
  return null;
}

/** Die Datenpunkt-ID aus dem Ressourcennamen. */
export function dataPointId(name: string): string {
  return name.split("/").pop() ?? name;
}

/** Google-Dauer ("1545s") in Sekunden. */
export function parseGoogleDuration(v: string | undefined | null): number {
  if (!v) return 0;
  const m = v.match(/^([\d.]+)s$/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

// ── Aktivitäten ────────────────────────────────────────────────────────────

/**
 * Aktivitäten ab `since`. Blättert alle Seiten durch.
 *
 * pageSize ist bei exercise und sleep auf 25 gedeckelt, bei den anderen Typen
 * liegt der Standard bei 1440.
 */
export async function listExercises(
  token: string,
  since: Date
): Promise<GoogleExercise[]> {
  const filter = `exercise.interval.civil_start_time >= "${civilFilterTime(since)}"`;
  const out: GoogleExercise[] = [];
  let pageToken = "";
  // Deckel gegen Endlosschleifen, falls die API einen Cursor zurückgibt, der
  // sich nicht erschöpft. 40 Seiten à 25 sind 1000 Aktivitäten.
  for (let page = 0; page < 40; page++) {
    const qs = new URLSearchParams({ pageSize: "25", filter });
    if (pageToken) qs.set("pageToken", pageToken);
    const body = await apiGet<ListResponse<GoogleExercise>>(
      token,
      `/users/me/dataTypes/exercise/dataPoints?${qs}`
    );
    out.push(...(body.dataPoints ?? []));
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return out;
}

/**
 * GPS-Track als TCX. Nur aufrufen, wenn exerciseMetadata.hasGps gesetzt ist.
 *
 * Das `alt=media` ist zwingend — ohne kommt ein JSON-Umschlag statt der Datei.
 */
export async function exportExerciseTcx(
  token: string,
  dataPointName: string
): Promise<string> {
  const res = await fetch(`${API}/${dataPointName}:exportExerciseTcx?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) {
    throw new GoogleAuthError("Google lehnt den Token ab (HTTP 401)");
  }
  if (!res.ok) {
    // 403 heisst hier in aller Regel: location-Scope nicht erteilt. Das ist
    // kein toter Token — die Aktivität bleibt ohne Route importierbar.
    throw new Error(`TCX-Export fehlgeschlagen (HTTP ${res.status})`);
  }
  return res.text();
}

// ── Schlaf ─────────────────────────────────────────────────────────────────

/**
 * Die letzten Schlafsessions, neueste zuerst.
 *
 * Ohne Filter, weil sleep keinen akzeptiert. `maxPages` begrenzt, wie weit
 * zurück geblättert wird — der Aufrufer bricht ab, sobald er bei bekannten
 * Nächten ankommt.
 */
export async function listSleep(
  token: string,
  maxPages = 2
): Promise<GoogleSleep[]> {
  const out: GoogleSleep[] = [];
  let pageToken = "";
  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({ pageSize: "25" });
    if (pageToken) qs.set("pageToken", pageToken);
    const body = await apiGet<ListResponse<GoogleSleep>>(
      token,
      `/users/me/dataTypes/sleep/dataPoints?${qs}`
    );
    out.push(...(body.dataPoints ?? []));
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return out;
}

// ── Tagesdaten ─────────────────────────────────────────────────────────────

export interface RollupPoint {
  civilStartTime?: { date?: { year: number; month: number; day: number } };
  steps?: { countSum?: string };
  activeEnergyBurned?: { kcalSum?: number };
  totalCalories?: { kcalSum?: number };
  distance?: { millimetersSum?: string };
  activeZoneMinutes?: {
    sumInFatBurnHeartZone?: string;
    sumInCardioHeartZone?: string;
    sumInPeakHeartZone?: string;
  };
  activeMinutes?: {
    activeMinutesRollupByActivityLevel?: {
      activityLevel: string;
      activeMinutesSum: string;
    }[];
  };
}

/**
 * Tagessummen eines Datentyps.
 *
 * Der Bereich ist bei den meisten Typen auf 90 Tage begrenzt, bei
 * total-calories und active-minutes auf 14.
 */
export async function dailyRollUp(
  token: string,
  dataType: string,
  from: Date,
  to: Date
): Promise<RollupPoint[]> {
  const body = await apiPost<{ rollupDataPoints?: RollupPoint[] }>(
    token,
    `/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`,
    {
      range: { start: civilDateTime(from), end: civilDateTime(to) },
      windowSizeDays: 1,
    }
  );
  return body.rollupDataPoints ?? [];
}

/** YYYY-MM-DD aus einem Rollup-Punkt. */
export function rollupDate(p: RollupPoint): string | null {
  const d = p.civilStartTime?.date;
  if (!d) return null;
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}
