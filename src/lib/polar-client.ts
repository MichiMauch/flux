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
}

interface PolarGpxPoint {
  lat: number;
  lng: number;
  time?: string;
  elevation?: number;
}

// ── OAuth ──────────────────────────────────────────────────────────────────

export function getAuthorizationUrl(callbackUrl: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.POLAR_CLIENT_ID!,
    redirect_uri: callbackUrl,
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
  const computed = Buffer.from(sig).toString("hex");

  return computed === signature;
}
