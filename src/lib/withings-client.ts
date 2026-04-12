import crypto from "crypto";

const WITHINGS_AUTH_URL = "https://account.withings.com/oauth2_user/authorize2";
const WITHINGS_API_URL = "https://wbsapi.withings.net/v2/oauth2";
const WITHINGS_MEASURE_URL = "https://wbsapi.withings.net/measure";

function sign(
  params: Record<string, string>,
  clientSecret: string
): string {
  const paramsToSign: Record<string, string> = {
    action: params.action,
    client_id: params.client_id,
  };
  if (params.timestamp) paramsToSign.timestamp = params.timestamp;
  if (params.nonce) paramsToSign.nonce = params.nonce;

  const sortedValues = Object.values(paramsToSign).join(",");
  const hmac = crypto.createHmac("sha256", clientSecret);
  hmac.update(sortedValues);
  return hmac.digest("hex");
}

async function getNonce(): Promise<string> {
  const clientId = process.env.WITHINGS_CLIENT_ID!;
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET!;
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const params = {
    action: "getnonce",
    client_id: clientId,
    timestamp,
  };
  const signature = sign(params, clientSecret);

  const body = new URLSearchParams({
    ...params,
    signature,
  });

  const res = await fetch(`${WITHINGS_API_URL}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = await res.json();
  if (data.status !== 0) {
    throw new Error(`Withings getnonce failed: ${JSON.stringify(data)}`);
  }
  return data.body.nonce;
}

// ── OAuth ──────────────────────────────────────────────────────────────────

export function getAuthorizationUrl(callbackUrl: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.WITHINGS_CLIENT_ID!,
    redirect_uri: callbackUrl,
    scope: "user.info,user.metrics,user.activity",
    state,
  });
  return `${WITHINGS_AUTH_URL}?${params}`;
}

export async function exchangeToken(
  code: string,
  callbackUrl: string
): Promise<{
  access_token: string;
  refresh_token: string;
  userid: string;
  expires_in: number;
}> {
  const clientId = process.env.WITHINGS_CLIENT_ID!;
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET!;
  const nonce = await getNonce();

  const params = {
    action: "requesttoken",
    client_id: clientId,
    nonce,
  };
  const signature = sign(params, clientSecret);

  const body = new URLSearchParams({
    action: "requesttoken",
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl,
    nonce,
    signature,
  });

  const res = await fetch(WITHINGS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = await res.json();
  console.log("Withings token exchange:", data.status);
  if (data.status !== 0) {
    throw new Error(`Withings token exchange failed: ${JSON.stringify(data)}`);
  }
  return data.body;
}

export async function refreshToken(
  currentRefreshToken: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const clientId = process.env.WITHINGS_CLIENT_ID!;
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET!;
  const nonce = await getNonce();

  const params = {
    action: "requesttoken",
    client_id: clientId,
    nonce,
  };
  const signature = sign(params, clientSecret);

  const body = new URLSearchParams({
    action: "requesttoken",
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: currentRefreshToken,
    nonce,
    signature,
  });

  const res = await fetch(WITHINGS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = await res.json();
  if (data.status !== 0) {
    throw new Error(`Withings refresh failed: ${JSON.stringify(data)}`);
  }
  return data.body;
}

// ── Measurements ───────────────────────────────────────────────────────────

interface WithingsMeasure {
  grpid: number;
  date: number; // unix timestamp
  measures: { type: number; value: number; unit: number }[];
}

export async function getWeightMeasurements(
  accessToken: string,
  startDate?: Date
): Promise<
  {
    id: number;
    date: Date;
    weight: number;
    fatMass?: number;
    muscleMass?: number;
    bmi?: number;
  }[]
> {
  const params: Record<string, string> = {
    action: "getmeas",
    meastype: "1", // weight
    category: "1", // real measurements (not objectives)
  };
  if (startDate) {
    params.startdate = Math.floor(startDate.getTime() / 1000).toString();
  }
  params.enddate = Math.floor(Date.now() / 1000).toString();

  const body = new URLSearchParams(params);

  const res = await fetch(WITHINGS_MEASURE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${accessToken}`,
    },
    body,
    cache: "no-store",
  });

  const data = await res.json();
  if (data.status !== 0) {
    throw new Error(`Withings getmeas failed: ${JSON.stringify(data)}`);
  }

  const groups: WithingsMeasure[] = data.body?.measuregrps ?? [];

  return groups.map((grp) => {
    const getValue = (type: number) => {
      const m = grp.measures.find((m) => m.type === type);
      return m ? m.value * Math.pow(10, m.unit) : undefined;
    };

    return {
      id: grp.grpid,
      date: new Date(grp.date * 1000),
      weight: getValue(1)!, // 1 = weight in kg
      fatMass: getValue(8), // 8 = fat mass in kg
      muscleMass: getValue(76), // 76 = muscle mass in kg
      bmi: getValue(11), // 11 = BMI
    };
  });
}
