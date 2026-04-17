/**
 * Strava API client (REST v3).
 *
 * Ported from ~/Documents/Development/strava-dashboard/lib/strava.ts
 * and extended with date-range + streams support for the flux importer.
 */

let cachedAccessToken: string | null = null;
let tokenExpiry = 0;

export async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }

  const refreshToken = process.env.STRAVA_REFRESH_TOKEN;
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error(
      "Missing Strava credentials (STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REFRESH_TOKEN)"
    );
  }

  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to refresh Strava access token: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedAccessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
  return cachedAccessToken;
}

export interface StravaActivity {
  id: number;
  name: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  start_date: string; // ISO UTC
  start_date_local: string; // ISO wall-clock
  timezone: string;
  average_speed: number;
  max_speed: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  elev_high?: number;
  elev_low?: number;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  map?: { summary_polyline: string | null };
  device_name?: string;
}

/**
 * Paginates /athlete/activities?after=<ts>&before=<ts>.
 * `after` is exclusive lower bound (activities after this time),
 * `before` is exclusive upper bound. Both are Unix seconds.
 */
export async function fetchActivitiesInRange(
  afterUnix: number,
  beforeUnix: number
): Promise<StravaActivity[]> {
  const token = await getAccessToken();
  const all: StravaActivity[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const url = `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}&after=${afterUnix}&before=${beforeUnix}`;
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(
        `Failed to fetch activities page ${page}: ${res.status} ${res.statusText}`
      );
    }
    const batch = (await res.json()) as StravaActivity[];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < perPage) break;
    page++;
    if (all.length >= 2000) break; // safety
  }
  return all;
}

export interface StreamEntry {
  type: string;
  data: number[] | [number, number][];
  series_type?: string;
  original_size?: number;
  resolution?: string;
}

export interface StravaStreams {
  latlng?: { data: [number, number][] };
  time?: { data: number[] };
  heartrate?: { data: number[] };
  velocity_smooth?: { data: number[] };
  altitude?: { data: number[] };
  distance?: { data: number[] };
}

/**
 * GET /activities/{id}/streams?keys=...&key_by_type=true
 *
 * Returns an object keyed by stream type. Returns `null` if the activity
 * has no streams (indoor / manual entries).
 */
export async function fetchStreams(id: number): Promise<StravaStreams | null> {
  const token = await getAccessToken();
  const keys = ["latlng", "time", "heartrate", "velocity_smooth", "altitude", "distance"].join(",");
  const url = `https://www.strava.com/api/v3/activities/${id}/streams?keys=${keys}&key_by_type=true`;
  const res = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `Failed to fetch streams for ${id}: ${res.status} ${res.statusText}`
    );
  }
  return (await res.json()) as StravaStreams;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempt = 1
): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 429 && attempt <= 3) {
    const wait = 60_000;
    console.warn(
      `  ⚠ Strava rate-limit 429, waiting ${wait / 1000}s (attempt ${attempt})…`
    );
    await new Promise((r) => setTimeout(r, wait));
    return fetchWithRetry(url, init, attempt + 1);
  }
  return res;
}
