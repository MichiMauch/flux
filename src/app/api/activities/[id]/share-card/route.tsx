import { ImageResponse } from "next/og";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities, activityPhotos, users } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { readFile } from "fs/promises";
import { activityTypeColor, activityTypeLabel } from "@/lib/activity-types";
import { activityTypeIcon } from "@/lib/activity-icon";
import { formatDurationHMS } from "@/lib/activity-format";

export const runtime = "nodejs";

type ShareFormat = "square" | "story";

type RoutePoint = {
  lat: number;
  lng: number;
};

type ActivityShareCardData = {
  id: string;
  name: string;
  type: string;
  startTime: Date;
  distance: number | null;
  movingTime: number | null;
  duration: number | null;
  ascent: number | null;
  routeGeometry: RoutePoint[] | null;
  routeData: RoutePoint[] | null;
  ownerId: string;
  ownerName: string | null;
  ownerPartnerId: string | null;
  photoPath: string | null;
};

const CACHE_SECONDS = 60 * 60;
const FLUX_WORDMARK = "FLUX";

function getFormat(raw: string | null): ShareFormat {
  return raw === "story" ? "story" : "square";
}

function metricValue(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "–";
  return value.toLocaleString("de-CH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDistance(distance: number | null): string {
  if (distance == null || !Number.isFinite(distance)) return "–";
  return (distance / 1000).toFixed(distance >= 10000 ? 1 : 2);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function sampleRoute(points: RoutePoint[] | null, max = 120): RoutePoint[] {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (points.length <= max) return points;
  const out: RoutePoint[] = [];
  for (let i = 0; i < max; i += 1) {
    const idx = Math.round((i * (points.length - 1)) / (max - 1));
    const p = points[idx];
    if (p) out.push(p);
  }
  return out;
}

function routeToPath(pointsIn: RoutePoint[] | null, width: number, height: number) {
  const points = sampleRoute(pointsIn, 96);
  if (points.length < 2) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;
  const pad = 32;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  return points
    .map((p, idx) => {
      const x = pad + ((p.lng - minLng) / lngRange) * innerW;
      const y = pad + innerH - ((p.lat - minLat) / latRange) * innerH;
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function iconForType(type: string): string {
  const Icon = activityTypeIcon(type);
  switch (Icon.displayName ?? Icon.name) {
    case "Footprints":
      return "RUN";
    case "Bike":
      return "RIDE";
    case "MountainSnow":
      return "HIKE";
    case "Waves":
      return "SWIM";
    case "Dumbbell":
      return "GYM";
    case "Snowflake":
      return "SKI";
    default:
      return "ACT";
  }
}

async function buildMapboxStaticDataUrl(
  routeIn: RoutePoint[] | null,
  width: number,
  height: number,
  strokeColor: string
): Promise<string | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const sampled = sampleRoute(routeIn, 80);
  const coords = sampled
    .filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180
    )
    .map((p) => [Number(p.lng.toFixed(5)), Number(p.lat.toFixed(5))]);
  if (coords.length < 2) return null;

  const geojson = {
    type: "Feature",
    properties: {
      stroke: strokeColor,
      "stroke-width": 4,
      "stroke-opacity": 0.95,
    },
    geometry: { type: "LineString", coordinates: coords },
  };
  const overlay = `geojson(${encodeURIComponent(JSON.stringify(geojson))})`;
  const reqW = Math.min(Math.round(width), 1280);
  const reqH = Math.min(Math.round(height), 1280);
  const url = `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${overlay}/auto/${reqW}x${reqH}@2x?access_token=${token}&padding=40`;
  if (url.length > 8000) return null;

  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function fileToDataUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const candidates = path.startsWith("/data/") ? [path, "." + path] : [path];
  for (const candidate of candidates) {
    try {
      const buf = await readFile(candidate);
      const mime = candidate.toLowerCase().endsWith(".png")
        ? "image/png"
        : candidate.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
      return `data:${mime};base64,${buf.toString("base64")}`;
    } catch {}
  }
  return null;
}

const getCachedActivityShareCardData = unstable_cache(
  async (activityId: string): Promise<ActivityShareCardData | null> => {
    const rows = await db
      .select({
        id: activities.id,
        name: activities.name,
        type: activities.type,
        startTime: activities.startTime,
        distance: activities.distance,
        movingTime: activities.movingTime,
        duration: activities.duration,
        ascent: activities.ascent,
        routeGeometry: activities.routeGeometry,
        routeData: activities.routeData,
        ownerId: activities.userId,
        ownerName: users.name,
        ownerPartnerId: users.partnerId,
      })
      .from(activities)
      .innerJoin(users, eq(activities.userId, users.id))
      .where(eq(activities.id, activityId))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const photoRows = await db
      .select({ path: activityPhotos.thumbnailPath })
      .from(activityPhotos)
      .where(eq(activityPhotos.activityId, activityId))
      .orderBy(asc(activityPhotos.takenAt), asc(activityPhotos.id))
      .limit(1);

    return {
      ...row,
      routeGeometry: row.routeGeometry as RoutePoint[] | null,
      routeData: row.routeData as RoutePoint[] | null,
      photoPath: photoRows[0]?.path ?? null,
    };
  },
  ["activity-share-card"],
  { revalidate: CACHE_SECONDS }
);

async function activityMatchesShareToken(activityId: string, token: string) {
  if (!token) return false;
  const rows = await db
    .select({ shareToken: activities.shareToken })
    .from(activities)
    .where(eq(activities.id, activityId))
    .limit(1);
  const stored = rows[0]?.shareToken;
  return !!stored && stored === token;
}

async function canReadActivity(activityId: string, viewerId: string) {
  const rows = await db
    .select({
      ownerId: activities.userId,
      ownerPartnerId: users.partnerId,
    })
    .from(activities)
    .innerJoin(users, eq(activities.userId, users.id))
    .where(eq(activities.id, activityId))
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  return row.ownerId === viewerId || row.ownerPartnerId === viewerId;
}

function CardMetric({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        gap: 12,
        borderRadius: 28,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.04)",
        padding: "22px 24px",
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.03), 0 20px 50px rgba(0,0,0,0.28), 0 0 0 1px ${accent}22`,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 16,
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.58)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 44,
          lineHeight: 1,
          color: "#f8f8f8",
          letterSpacing: "0.02em",
          textShadow: `0 0 20px ${accent}44`,
        }}
      >
        {value}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 16,
          lineHeight: 1,
          color: accent,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        {unit}
      </div>
    </div>
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const shareToken = new URL(request.url).searchParams.get("share");

  // Two access paths:
  //  - public link previews (WhatsApp/Telegram/etc.) fetch with ?share=<token>
  //    and no session — validate the token against the activity.
  //  - the owner/partner views the card while logged in (no token).
  let allowed = false;
  let viaShareToken = false;
  if (shareToken) {
    allowed = await activityMatchesShareToken(id, shareToken);
    viaShareToken = allowed;
  } else {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }
    allowed = await canReadActivity(id, session.user.id);
  }
  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const cached = await getCachedActivityShareCardData(id);
  if (!cached) {
    return new Response("Not found", { status: 404 });
  }
  // unstable_cache serialisiert via JSON → Date wird zu String. Rehydrieren.
  const data = {
    ...cached,
    startTime:
      cached.startTime instanceof Date
        ? cached.startTime
        : new Date(cached.startTime),
  };

  const format = getFormat(new URL(request.url).searchParams.get("format"));
  const width = 1080;
  const height = format === "story" ? 1920 : 1080;
  const accent = activityTypeColor(data.type);
  const dimAccent = `${accent}66`;
  const mapBoxW = format === "story" ? 920 : 500;
  const mapBoxH = format === "story" ? 520 : 420;
  const routeForMap =
    data.routeGeometry && data.routeGeometry.length > 1
      ? data.routeGeometry
      : data.routeData;
  const routePath = routeToPath(routeForMap, mapBoxW, mapBoxH);
  const mapImageUrl = await buildMapboxStaticDataUrl(
    routeForMap,
    mapBoxW,
    mapBoxH,
    accent
  );
  const photoUrl = await fileToDataUrl(data.photoPath);
  const duration = data.movingTime ?? data.duration ?? 0;
  const icon = iconForType(data.type);
  const dateLabel = formatDate(data.startTime);
  const ownerLabel = data.ownerName ?? "Flux";
  const activityLabel = activityTypeLabel(data.type).toUpperCase();
  const cardTitle = data.name.toUpperCase();

  const response = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(circle at top left, rgba(255,255,255,0.08), transparent 30%), linear-gradient(160deg, #050505 0%, #0c0c0c 42%, #121212 100%)",
          color: "white",
          padding: format === "story" ? 64 : 56,
          fontFamily: "JetBrains Mono, Menlo, monospace",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 22%, transparent 78%, rgba(255,255,255,0.03) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -180,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: 999,
            background: `${accent}20`,
            filter: "blur(30px)",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 108,
                height: 54,
                borderRadius: 999,
                border: `1px solid ${dimAccent}`,
                background: `${accent}18`,
                color: accent,
                fontSize: 24,
                letterSpacing: "0.16em",
              }}
            >
              {icon}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  letterSpacing: "0.26em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.54)",
                }}
              >
                {activityLabel}
              </div>
              <div
                style={{
                  fontSize: 24,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {dateLabel}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 18,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.72)",
            }}
          >
            <span style={{ color: accent }}>{FLUX_WORDMARK}</span>
            <span style={{ color: "rgba(255,255,255,0.42)" }}>
              {ownerLabel.toUpperCase()}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: format === "story" ? "column" : "row",
            gap: 30,
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: format === "story" ? "0 0 auto" : 1.12,
              minHeight: format === "story" ? 0 : "100%",
              gap: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                padding: "20px 24px 0 0",
              }}
            >
              <div
                style={{
                  fontSize: format === "story" ? 72 : 82,
                  lineHeight: 0.92,
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                  textTransform: "uppercase",
                  textShadow: `0 0 36px ${accent}30`,
                }}
              >
                {cardTitle}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: format === "story" ? "column" : "row",
                gap: 18,
              }}
            >
              <div style={{ display: "flex", flex: 1 }}>
                <CardMetric
                  label="Distanz"
                  value={formatDistance(data.distance)}
                  unit="KM"
                  accent={accent}
                />
              </div>
              <div style={{ display: "flex", flex: 1 }}>
                <CardMetric
                  label="Zeit"
                  value={formatDurationHMS(duration)}
                  unit="MOV"
                  accent={accent}
                />
              </div>
              <div style={{ display: "flex", flex: 1 }}>
                <CardMetric
                  label="Aufstieg"
                  value={metricValue(data.ascent)}
                  unit="M"
                  accent={accent}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 0.88,
              gap: 20,
            }}
          >
            {photoUrl ? (
              <div
                style={{
                  display: "flex",
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 34,
                  border: `1px solid ${dimAccent}`,
                  background: "#0f0f0f",
                  minHeight: format === "story" ? 620 : 320,
                }}
              >
                {/* next/image is not available inside next/og ImageResponse trees. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.2) 58%, rgba(0,0,0,0.5))",
                  }}
                />
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                position: "relative",
                overflow: "hidden",
                borderRadius: 34,
                border: `1px solid ${dimAccent}`,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                minHeight: format === "story" ? 520 : 420,
              }}
            >
              {mapImageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mapImageUrl}
                    alt=""
                    width={mapBoxW}
                    height={mapBoxH}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.0) 25%, rgba(0,0,0,0.0) 70%, rgba(0,0,0,0.45) 100%)",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      position: "relative",
                      padding: 24,
                      fontSize: 16,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.92)",
                      textShadow: "0 1px 6px rgba(0,0,0,0.6)",
                    }}
                  >
                    Route
                  </div>
                </>
              ) : routePath ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    padding: 28,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: 16,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.58)",
                      marginBottom: 16,
                    }}
                  >
                    Route
                  </div>
                  <svg
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${mapBoxW} ${mapBoxH}`}
                    style={{ display: "flex", flex: 1 }}
                  >
                    <defs>
                      <linearGradient
                        id="routeStroke"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#ffffff"
                          stopOpacity="0.55"
                        />
                        <stop offset="100%" stopColor={accent} stopOpacity="1" />
                      </linearGradient>
                    </defs>
                    <path
                      d={routePath}
                      fill="none"
                      stroke="url(#routeStroke)"
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.96"
                    />
                  </svg>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 26,
                    border: "1px dashed rgba(255,255,255,0.14)",
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 24,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                  }}
                >
                  Keine Route
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
    }
  );

  response.headers.set(
    "Cache-Control",
    viaShareToken
      ? `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`
      : `private, max-age=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`
  );
  response.headers.set(
    "Content-Disposition",
    `inline; filename="${data.startTime.toISOString().slice(0, 10)}-${data.id}-share-card.png"`
  );

  return response;
}
