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
    "perceived-load"?: number;
    "perceived-load-interpretation"?: string;
    "user-rpe"?: string;
  };
  "running-index"?: number;
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

// ── Daily Activity (non-transactional, /v3/users/activities*) ──────────────
// Polar's recommended replacement for the deprecated activity-transactions
// flow. We discover days via the list endpoint with a date range and pull
// the full samples in a single call.

export interface PolarActivityV3 {
  start_time?: string;
  end_time?: string;
  active_duration?: string; // ISO duration
  inactive_duration?: string; // ISO duration
  daily_activity?: number; // 0-100, goal completion %
  calories?: number;
  active_calories?: number;
  steps?: number;
  inactivity_alert_count?: number;
  distance_from_steps?: number;
  samples?: {
    date?: string;
    steps?: { interval_ms?: number; total_steps?: number; samples?: unknown[] };
    activity_zones?: { samples?: unknown[] };
    // Polar dokumentiert dies als Array, liefert aber tatsächlich
    // {samples: [...]}. Beide Shapes hier zulassen.
    inactivity_stamps?:
      | Array<{ stamp: string }>
      | { samples?: Array<{ stamp: string }> };
  };
  [k: string]: unknown;
}

/**
 * List daily activities (non-transactional). Polar's recommended replacement
 * for the deprecated activity-transactions flow. Returns last 28 days when
 * no range given. Maximum range is 28 days; max age is 365 days.
 */
export async function listActivitiesV3(
  token: string,
  opts: {
    from?: string; // YYYY-MM-DD
    to?: string;
    inactivityStamps?: boolean;
    activityZones?: boolean;
    steps?: boolean;
  } = {},
): Promise<PolarActivityV3[]> {
  const params = new URLSearchParams();
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.inactivityStamps) params.set("inactivity_stamps", "true");
  if (opts.activityZones) params.set("activity_zones", "true");
  if (opts.steps) params.set("steps", "true");
  const qs = params.toString();
  const url = `${POLAR_API_BASE}/v3/users/activities${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status === 204 || res.status === 404 || res.status === 400) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list v3 activities: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Fetch daily activity for a date via the new v3 endpoint. Returns null on
 * 204/404 (no data). Date must be within the last 365 days per Polar.
 */
export async function getDailyActivityV3(
  token: string,
  date: string,
  opts: {
    inactivityStamps?: boolean;
    activityZones?: boolean;
    steps?: boolean;
  } = {}
): Promise<PolarActivityV3 | null> {
  const params = new URLSearchParams();
  if (opts.inactivityStamps) params.set("inactivity_stamps", "true");
  if (opts.activityZones) params.set("activity_zones", "true");
  if (opts.steps) params.set("steps", "true");
  const qs = params.toString();
  const url = `${POLAR_API_BASE}/v3/users/activities/${date}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status === 204 || res.status === 404) return null;
  if (res.status === 400) return null; // outdated date (>365d)
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get v3 daily activity ${date}: ${res.status} ${text}`);
  }
  return res.json();
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

// ── Generic helper for the simpler v3 GET endpoints ────────────────────────

async function polarGet<T>(token: string, path: string): Promise<T | null> {
  const url = path.startsWith("http") ? path : `${POLAR_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status === 204 || res.status === 404 || res.status === 400) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Physical Information (/v3/users/physical-info) ─────────────────────────

export interface PolarPhysicalInfo {
  weight?: number;
  height?: number;
  birthday?: string; // YYYY-MM-DD
  gender?: "MALE" | "FEMALE" | string;
  maximum_heart_rate?: number;
  resting_heart_rate?: number;
  aerobic_threshold?: number;
  anaerobic_threshold?: number;
  vo2_max?: number;
  weight_source?: string;
  training_background?: string;
  typical_day?: string;
  sleep_goal?: string; // ISO duration PT8H
  created?: string;
  modified?: string;
  [k: string]: unknown;
}

export async function getPhysicalInfo(
  token: string,
): Promise<PolarPhysicalInfo | null> {
  return polarGet<PolarPhysicalInfo>(token, "/v3/users/physical-info");
}

// ── Cardio Load (/v3/users/cardio-load) ────────────────────────────────────

export interface PolarCardioLoad {
  date: string;
  cardio_load_status?: string;
  cardio_load?: number;
  strain?: number;
  tolerance?: number;
  cardio_load_ratio?: number;
  cardio_load_level?: {
    very_low?: number;
    low?: number;
    medium?: number;
    high?: number;
    very_high?: number;
  };
  [k: string]: unknown;
}

export async function listCardioLoad(token: string): Promise<PolarCardioLoad[]> {
  const data = await polarGet<PolarCardioLoad[] | { items?: PolarCardioLoad[] }>(
    token,
    "/v3/users/cardio-load",
  );
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

// ── Continuous Heart Rate (/v3/users/continuous-heart-rate/{date}) ─────────

export interface PolarContinuousHr {
  polar_user?: string;
  date: string;
  heart_rate_samples?: Array<{ heart_rate: number; sample_time: string }>;
  [k: string]: unknown;
}

export async function getContinuousHeartRate(
  token: string,
  date: string,
): Promise<PolarContinuousHr | null> {
  return polarGet<PolarContinuousHr>(
    token,
    `/v3/users/continuous-heart-rate/${date}`,
  );
}

// ── SleepWise (/v3/users/sleepwise/*) ──────────────────────────────────────
// Polar's docs write the path as "sleep-wise" (hyphen), but the LIVE endpoint
// is "sleepwise" (no hyphen). Verified against the API for both users.

export interface PolarSleepWiseAlertness {
  grade?: number;
  grade_validity_seconds?: number;
  grade_type?: string;
  grade_classification?: string;
  validity?: string;
  sleep_inertia?: string;
  sleep_type?: string;
  [k: string]: unknown;
}

export interface PolarCircadianBedtime {
  validity?: string;
  quality?: string;
  result_type?: string;
  period_start_time?: string;
  period_end_time?: string;
  [k: string]: unknown;
}

export async function getSleepWiseAlertness(
  token: string,
): Promise<PolarSleepWiseAlertness[] | null> {
  const data = await polarGet<
    PolarSleepWiseAlertness[] | { items?: PolarSleepWiseAlertness[] }
  >(token, "/v3/users/sleepwise/alertness");
  if (!data) return null;
  if (Array.isArray(data)) return data;
  return data.items ?? null;
}

export async function getSleepWiseCircadianBedtime(
  token: string,
): Promise<PolarCircadianBedtime[] | null> {
  const data = await polarGet<
    PolarCircadianBedtime[] | { items?: PolarCircadianBedtime[] }
  >(token, "/v3/users/sleepwise/circadian-bedtime");
  if (!data) return null;
  if (Array.isArray(data)) return data;
  return data.items ?? null;
}

// ── Elixir Biosensing (/v3/users/biosensing/*) ─────────────────────────────
// These were impossible to find from the docs page — discovered via the live
// swagger.yaml at https://www.polar.com/accesslink-api/swagger.yaml. All five
// endpoints accept optional `from` and `to` query params (ISO dates, max 28
// days range). Returns 200 with array, 204 if no data.

export interface PolarBodyTemperaturePeriod {
  source_device_id?: string;
  measurement_type?: "TM_UNKNOWN" | "TM_SKIN_TEMPERATURE" | "TM_CORE_TEMPERATURE" | string;
  sensor_location?: "SL_UNKNOWN" | "SL_DISTAL" | "SL_PROXIMAL" | string;
  start_time?: string;
  end_time?: string;
  modified_time?: string;
  samples?: Array<{
    temperature_celsius: number;
    recording_time_delta_milliseconds: number;
  }>;
  [k: string]: unknown;
}

export interface PolarSkinTemperatureNight {
  sleep_time_skin_temperature_celsius?: number;
  deviation_from_baseline_celsius?: number;
  sleep_date?: string;
  [k: string]: unknown;
}

export interface PolarSkinContactPeriod {
  source_device_id?: string;
  start_time?: string;
  end_time?: string;
  modified_time?: string;
  skin_contact_changes?: Array<{
    skin_contact?: boolean;
    recording_time_delta_milliseconds?: number;
  }>;
  [k: string]: unknown;
}

export interface PolarEcgTestResult {
  source_device_id?: string;
  test_time?: number; // unix epoch
  time_zone_offset?: number;
  average_heart_rate_bpm?: number;
  heart_rate_variability_ms?: number;
  heart_rate_variability_level?: string;
  [k: string]: unknown;
}

export interface PolarSpo2TestResult {
  source_device_id?: string;
  test_time?: number; // unix epoch
  time_zone_offset?: number;
  test_status?: string;
  blood_oxygen_percent?: number;
  [k: string]: unknown;
}

function biosensingPath(
  resource: string,
  from?: string,
  to?: string,
): string {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const q = qs.toString();
  return `/v3/users/biosensing/${resource}${q ? `?${q}` : ""}`;
}

export async function getBodyTemperature(
  token: string,
  from?: string,
  to?: string,
): Promise<PolarBodyTemperaturePeriod[] | null> {
  const data = await polarGet<PolarBodyTemperaturePeriod[]>(
    token,
    biosensingPath("bodytemperature", from, to),
  );
  return Array.isArray(data) ? data : null;
}

export async function getSkinTemperature(
  token: string,
  from?: string,
  to?: string,
): Promise<PolarSkinTemperatureNight[] | null> {
  const data = await polarGet<PolarSkinTemperatureNight[]>(
    token,
    biosensingPath("skintemperature", from, to),
  );
  return Array.isArray(data) ? data : null;
}

export async function getSkinContacts(
  token: string,
  from?: string,
  to?: string,
): Promise<PolarSkinContactPeriod[] | null> {
  const data = await polarGet<PolarSkinContactPeriod[]>(
    token,
    biosensingPath("skincontacts", from, to),
  );
  return Array.isArray(data) ? data : null;
}

export async function getWristEcg(
  token: string,
  from?: string,
  to?: string,
): Promise<PolarEcgTestResult[] | null> {
  const data = await polarGet<PolarEcgTestResult[]>(
    token,
    biosensingPath("ecg", from, to),
  );
  return Array.isArray(data) ? data : null;
}

export async function getSpo2(
  token: string,
  from?: string,
  to?: string,
): Promise<PolarSpo2TestResult[] | null> {
  const data = await polarGet<PolarSpo2TestResult[]>(
    token,
    biosensingPath("spo2", from, to),
  );
  return Array.isArray(data) ? data : null;
}

/** ISO duration → seconds, or null on bad input. */
export function parseIsoDurationStrict(s: string | undefined | null): number | null {
  return parseIsoDuration(s);
}
