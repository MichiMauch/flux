import { timingSafeEqual } from "crypto";

const POLAR_API_BASE = "https://www.polaraccesslink.com";
const POLAR_AUTH_URL = "https://flow.polar.com/oauth2/authorization";
const POLAR_TOKEN_URL = "https://polarremote.com/v2/oauth2/token";

interface PolarTokenResponse {
  access_token: string;
  token_type: string;
  x_user_id: number;
}

interface PolarExercise {
  id: string;
  upload_time: string;
  polar_user: string;
  device: string;
  device_id: string;
  start_time: string;
  start_time_utc_offset?: number;
  duration: string;
  calories: number;
  distance: number;
  heart_rate: {
    average: number;
    maximum: number;
  };
  training_load: number;
  sport: string;
  has_route: boolean;
  detailed_sport_info: string;
  fat_percentage?: number;
  carbohydrate_percentage?: number;
  protein_percentage?: number;
  training_load_pro?: {
    "cardio-load"?: number;
    "cardio-load-interpretation"?: string;
    "muscle-load"?: number;
    "muscle-load-interpretation"?: string;
  };
}

interface PolarGpxPoint {
  lat: number;
  lng: number;
  time?: string;
  elevation?: number;
}

// Polar returns `start_time` as wall-clock local time without timezone info
// (e.g. "2026-04-14T10:30:00.000") plus `start_time_utc_offset` in minutes.
// `new Date(start_time)` would parse it as server-local time, producing a
// wrong instant on non-local servers (e.g. UTC in prod). Combine both fields
// to get the correct UTC instant.
export function parsePolarStartTime(
  startTime: string,
  utcOffsetMinutes: number | undefined
): Date {
  const offset = utcOffsetMinutes ?? 0;
  const asIfUtc = Date.parse(startTime + "Z");
  return new Date(asIfUtc - offset * 60_000);
}

// ── OAuth ──────────────────────────────────────────────────────────────────

export function getAuthorizationUrl(
  callbackUrl: string,
  state: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.POLAR_CLIENT_ID!,
    redirect_uri: callbackUrl,
    state,
  });
  return `${POLAR_AUTH_URL}?${params}`;
}

export async function exchangeToken(
  code: string,
  callbackUrl: string
): Promise<PolarTokenResponse> {
  const credentials = Buffer.from(
    `${process.env.POLAR_CLIENT_ID}:${process.env.POLAR_CLIENT_SECRET}`
  ).toString("base64");

  console.log("Exchanging token with Polar...", { code: code.slice(0, 8) + "...", callbackUrl });

  const res = await fetch(POLAR_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
    }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Polar token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ── User Registration ──────────────────────────────────────────────────────

export async function registerUser(token: string, polarUserId: string): Promise<void> {
  const res = await fetch(`${POLAR_API_BASE}/v3/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ "member-id": `user_${polarUserId}` }),
    cache: "no-store",
  });

  const text = await res.text();
  console.log("Polar user registration:", res.status, text);

  // 409 = already registered, that's fine
  if (!res.ok && res.status !== 409) {
    throw new Error(`Polar user registration failed: ${res.status} ${text}`);
  }
}

// ── Exercises (Transaction Flow) ───────────────────────────────────────────

export async function listExercises(
  token: string
): Promise<PolarExercise[]> {
  // List available exercises
  const res = await fetch(`${POLAR_API_BASE}/v3/exercises`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 204) return []; // no new data
    const text = await res.text();
    throw new Error(`Failed to list exercises: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getExercise(
  token: string,
  exerciseId: string
): Promise<PolarExercise> {
  const res = await fetch(`${POLAR_API_BASE}/v3/exercises/${exerciseId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get exercise: ${res.status} ${text}`);
  }

  return res.json();
}

export async function downloadFit(
  token: string,
  exerciseId: string
): Promise<ArrayBuffer> {
  const res = await fetch(
    `${POLAR_API_BASE}/v3/exercises/${exerciseId}/fit`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/octet-stream",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to download FIT: ${res.status} ${text}`);
  }

  return res.arrayBuffer();
}

export async function downloadGpx(
  token: string,
  exerciseId: string
): Promise<string> {
  const res = await fetch(
    `${POLAR_API_BASE}/v3/exercises/${exerciseId}/gpx`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/gpx+xml",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to download GPX: ${res.status} ${text}`);
  }

  return res.text();
}

// ── Daily Activity (Transaction Flow) ──────────────────────────────────────

export interface PolarDailyActivity {
  id: string;
  polar_user: string;
  transaction_id?: number;
  date: string; // YYYY-MM-DD
  created: string; // ISO
  calories?: number;
  "active-calories"?: number;
  duration?: string; // ISO duration PT…
  "active-steps"?: number;
  distance?: number;
  "active-time-goal"?: string; // ISO duration
  "active-time-zones"?: Array<{
    index: number;
    "inzone-duration"?: string;
  }>;
  "active-goal-completion"?: number; // 0-1 or 0-100 depending on API
  "inactivity-stamps"?: string[];
  // Catch-all for any extra fields Polar adds
  [key: string]: unknown;
}

interface ActivityTransactionStart {
  "transaction-id": number;
  "resource-uri": string;
}

interface ActivityListResponse {
  "activity-log"?: string[];
}

export async function createActivityTransaction(
  token: string,
  polarUserId: string
): Promise<ActivityTransactionStart | null> {
  const res = await fetch(
    `${POLAR_API_BASE}/v3/users/${polarUserId}/activity-transactions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );
  if (res.status === 204) return null; // no new data
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create activity transaction: ${res.status} ${text}`);
  }
  return res.json();
}

export async function listDailyActivities(
  token: string,
  polarUserId: string,
  transactionId: number
): Promise<string[]> {
  const res = await fetch(
    `${POLAR_API_BASE}/v3/users/${polarUserId}/activity-transactions/${transactionId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );
  if (res.status === 204) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list daily activities: ${res.status} ${text}`);
  }
  const data = (await res.json()) as ActivityListResponse;
  return data["activity-log"] ?? [];
}

export async function getDailyActivity(
  token: string,
  url: string
): Promise<PolarDailyActivity> {
  // Polar returns absolute URLs in the activity-log; use them directly.
  const full = url.startsWith("http") ? url : `${POLAR_API_BASE}${url}`;
  const res = await fetch(full, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get daily activity: ${res.status} ${text}`);
  }
  return res.json();
}

export async function commitActivityTransaction(
  token: string,
  polarUserId: string,
  transactionId: number
): Promise<void> {
  const res = await fetch(
    `${POLAR_API_BASE}/v3/users/${polarUserId}/activity-transactions/${transactionId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );
  if (!res.ok && res.status !== 200 && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Failed to commit activity transaction: ${res.status} ${text}`);
  }
}

// ── Sleep (AccessLink /v3/users/sleep) ─────────────────────────────────────

export interface PolarSleepListItem {
  date: string;
  polar_user?: string;
}

export interface PolarSleepStageElement {
  "seconds-in-sleep-stage"?: number;
  "sleep-stage"?: string | number;
  stage?: string;
  duration?: number;
  offset?: number;
  [k: string]: unknown;
}

export interface PolarSleep {
  polar_user?: string;
  date: string;
  sleep_start_time?: string;
  sleep_end_time?: string;
  device_id?: string;
  continuity?: number;
  continuity_class?: number;
  light_sleep?: number;
  deep_sleep?: number;
  rem_sleep?: number;
  unrecognized_sleep_stage?: number;
  total_interruption_duration?: number;
  short_interruption_duration?: number;
  long_interruption_duration?: number;
  sleep_goal?: number;
  sleep_rating?: number;
  sleep_score?: number;
  sleep_charge?: number;
  sleep_cycles?: number;
  group_duration_score?: number;
  group_solidity_score?: number;
  group_regeneration_score?: number;
  hypnogram?: unknown;
  heart_rate_samples?: unknown;
  [k: string]: unknown;
}

export interface PolarNight {
  polar_user?: string;
  date: string;
  heart_rate_avg?: number;
  beat_to_beat_avg?: number;
  heart_rate_variability_avg?: number;
  breathing_rate_avg?: number;
  nightly_recharge_status?: number;
  ans_charge?: number;
  ans_charge_status?: number;
  sleep_charge?: number;
  sleep_charge_status?: number;
  [k: string]: unknown;
}

interface SleepListResponse {
  nights?: PolarSleepListItem[];
}

interface NightsListResponse {
  recharges?: PolarSleepListItem[];
}

export async function listSleep(token: string): Promise<PolarSleepListItem[]> {
  const res = await fetch(`${POLAR_API_BASE}/v3/users/sleep`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (res.status === 204) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list sleep: ${res.status} ${text}`);
  }
  const data = (await res.json()) as SleepListResponse | PolarSleepListItem[];
  if (Array.isArray(data)) return data;
  return data.nights ?? [];
}

export async function getSleep(
  token: string,
  date: string
): Promise<PolarSleep | null> {
  const res = await fetch(`${POLAR_API_BASE}/v3/users/sleep/${date}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get sleep ${date}: ${res.status} ${text}`);
  }
  return res.json();
}

export async function listNights(token: string): Promise<PolarSleepListItem[]> {
  const res = await fetch(`${POLAR_API_BASE}/v3/users/nights`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (res.status === 204) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list nights: ${res.status} ${text}`);
  }
  const data = (await res.json()) as NightsListResponse | PolarSleepListItem[];
  if (Array.isArray(data)) return data;
  return data.recharges ?? [];
}

export async function getNight(
  token: string,
  date: string
): Promise<PolarNight | null> {
  const res = await fetch(`${POLAR_API_BASE}/v3/users/nights/${date}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get night ${date}: ${res.status} ${text}`);
  }
  return res.json();
}

/** Parse an ISO 8601 duration (PT1H30M45S) into seconds. */
export function parseIsoDuration(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m) return null;
  const h = parseFloat(m[1] || "0");
  const mm = parseFloat(m[2] || "0");
  const ss = parseFloat(m[3] || "0");
  return Math.round(h * 3600 + mm * 60 + ss);
}

// ── Webhook Validation ─────────────────────────────────────────────────────

export async function validateWebhookSignature(
  body: string,
  signature: string
): Promise<boolean> {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computed = Buffer.from(sig);
  let received: Buffer;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  if (computed.length !== received.length) return false;
  return timingSafeEqual(computed, received);
}
