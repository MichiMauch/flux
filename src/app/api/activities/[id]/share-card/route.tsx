import { ImageResponse } from "next/og";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities, activityPhotos, users } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { readFile } from "fs/promises";
import { activityTypeColor, activityTypeLabel } from "@/lib/activity-types";
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

// Project route to an SVG path that fits a width×height box while preserving
// the geographic aspect ratio (so the route isn't stretched). Used only as a
// fallback when the Mapbox static image is unavailable.
function routeToPath(
  pointsIn: RoutePoint[] | null,
  width: number,
  height: number
) {
  const points = sampleRoute(pointsIn, 96);
  if (points.length < 2) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.001;
  // longitude degrees shrink with latitude — correct for it so the shape
  // matches what a map would show.
  const midLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180) || 1;
  const lngRange = (maxLng - minLng) * lngScale || 0.001;

  const pad = 120;
  const boxW = width - pad * 2;
  const boxH = height - pad * 2;
  const scale = Math.min(boxW / lngRange, boxH / latRange);
  const drawW = lngRange * scale;
  const drawH = latRange * scale;
  const offX = pad + (boxW - drawW) / 2;
  const offY = pad + (boxH - drawH) / 2;

  return points
    .map((p, idx) => {
      const x = offX + ((p.lng - minLng) * lngScale) * scale;
      const y = offY + drawH - (p.lat - minLat) * scale;
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

// Google "encoded polyline" (precision 5) — far more compact than GeoJSON,
// so two stacked overlays (casing + line) stay well under Mapbox's URL cap.
function encodePolyline(coords: number[][]): string {
  let lastLat = 0;
  let lastLng = 0;
  let result = "";
  const enc = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let out = "";
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
    return out;
  };
  for (const [lng, lat] of coords) {
    const la = Math.round(lat * 1e5);
    const lo = Math.round(lng * 1e5);
    result += enc(la - lastLat) + enc(lo - lastLng);
    lastLat = la;
    lastLng = lo;
  }
  return result;
}

// Full-bleed Mapbox static map with the route baked in as a line overlay.
// Requested at the card's own size/aspect so it fills the canvas exactly
// (no objectFit guesswork in Satori).
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

  // White casing under the accent line for contrast on any map background
  // (same halo technique as the interactive Wanderkarte: white under, accent
  // on top). Two stacked path overlays, drawn bottom-to-top in URL order.
  const poly = encodeURIComponent(encodePolyline(coords));
  const hex = strokeColor.replace("#", "");
  const overlay = `path-13+ffffff-1(${poly}),path-6+${hex}-1(${poly})`;
  // Mapbox caps static images at 1280px per side (no @2x here — 1080 would
  // exceed the cap when doubled). padding keeps the route inset from edges.
  const reqW = Math.min(Math.round(width), 1280);
  const reqH = Math.min(Math.round(height), 1280);
  const url = `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${overlay}/auto/${reqW}x${reqH}?access_token=${token}&padding=100`;
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

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          fontSize: 19,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.62)",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <div style={{ display: "flex", fontSize: 62, lineHeight: 1, fontWeight: 700 }}>
          {value}
        </div>
        {unit ? (
          <div
            style={{
              display: "flex",
              fontSize: 22,
              marginBottom: 7,
              color: accent,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {unit}
          </div>
        ) : null}
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

  const routeForMap =
    data.routeGeometry && data.routeGeometry.length > 1
      ? data.routeGeometry
      : data.routeData;

  // Request the map at the card's aspect ratio, capped to Mapbox's 1280px
  // limit, so it fills the full canvas with no distortion.
  const cap = 1280;
  const mapScale = Math.min(1, cap / Math.max(width, height));
  const mapReqW = Math.round(width * mapScale);
  const mapReqH = Math.round(height * mapScale);

  const mapImageUrl = await buildMapboxStaticDataUrl(
    routeForMap,
    mapReqW,
    mapReqH,
    accent
  );
  const routePath = routeToPath(routeForMap, width, height);
  const photoUrl = await fileToDataUrl(data.photoPath);

  // Background priority: map-with-route > photo > dark gradient.
  const bgUrl = mapImageUrl ?? photoUrl;

  const isFlight =
    new URL(request.url).searchParams.get("variant") === "flight";
  const duration = data.movingTime ?? data.duration ?? 0;
  const typeLabel = activityTypeLabel(data.type).toUpperCase();
  const dateLabel = formatDate(data.startTime);
  const ownerLabel = (data.ownerName ?? "Flux").toUpperCase();
  const cardTitle = data.name.toUpperCase();
  const pad = format === "story" ? 72 : 64;
  const playSize = format === "story" ? 220 : 180;

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
            "linear-gradient(160deg, #0a0a0a 0%, #111 55%, #0a0a0a 100%)",
          color: "white",
          fontFamily: "JetBrains Mono, Menlo, monospace",
        }}
      >
        {/* Full-bleed background: map (with route) or photo. Requested at the
            card aspect ratio, so width/height 100% fills it exactly. */}
        {bgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgUrl}
            alt=""
            width={width}
            height={height}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : routePath ? (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <path
              d={routePath}
              fill="none"
              stroke="#ffffff"
              strokeWidth="20"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
            />
            <path
              d={routePath}
              fill="none"
              stroke={accent}
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="1"
            />
          </svg>
        ) : null}

        {/* Top scrim for header legibility */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: Math.round(height * 0.3),
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
          }}
        />
        {/* Bottom scrim for title + stats legibility */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: Math.round(height * 0.56),
            background:
              "linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.62) 42%, rgba(0,0,0,0) 100%)",
          }}
        />

        {/* Flight cards get a centred play button so the recipient instantly
            reads it as a flythrough, not a static map. */}
        {isFlight ? (
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: playSize,
                height: playSize,
                borderRadius: 999,
                background: "rgba(0,0,0,0.42)",
                border: "4px solid rgba(255,255,255,0.92)",
                boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
              }}
            >
              <svg
                width={Math.round(playSize * 0.42)}
                height={Math.round(playSize * 0.42)}
                viewBox="0 0 100 100"
              >
                <polygon points="32,20 82,50 32,80" fill="#ffffff" />
              </svg>
            </div>
          </div>
        ) : null}

        {/* Content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: pad,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 22px",
                  height: 52,
                  borderRadius: 999,
                  border: `1px solid ${accent}`,
                  background: `${accent}26`,
                  color: "#fff",
                  fontSize: 23,
                  letterSpacing: "0.16em",
                  textShadow: "0 1px 6px rgba(0,0,0,0.6)",
                }}
              >
                {typeLabel}
              </div>
              {isFlight ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0 20px",
                    height: 52,
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.85)",
                    background: "rgba(6,182,212,0.32)",
                    color: "#fff",
                    fontSize: 22,
                    letterSpacing: "0.18em",
                    textShadow: "0 1px 6px rgba(0,0,0,0.6)",
                  }}
                >
                  ▶ 3D-FLUG
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    fontSize: 23,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.92)",
                    textShadow: "0 1px 6px rgba(0,0,0,0.7)",
                  }}
                >
                  {dateLabel}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 22,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                textShadow: "0 1px 6px rgba(0,0,0,0.7)",
              }}
            >
              <div style={{ display: "flex", color: accent }}>
                {FLUX_WORDMARK}
              </div>
              <div style={{ display: "flex", color: "rgba(255,255,255,0.72)" }}>
                {ownerLabel}
              </div>
            </div>
          </div>

          {/* Footer: title + stats over the scrim */}
          <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
            <div
              style={{
                display: "flex",
                fontSize: format === "story" ? 78 : 72,
                lineHeight: 0.94,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                textTransform: "uppercase",
                textShadow: "0 2px 22px rgba(0,0,0,0.75)",
              }}
            >
              {cardTitle}
            </div>

            <div style={{ display: "flex", flexDirection: "row", gap: 56 }}>
              <Stat
                label="Distanz"
                value={formatDistance(data.distance)}
                unit="km"
                accent={accent}
              />
              <Stat
                label="Zeit"
                value={formatDurationHMS(duration)}
                accent={accent}
              />
              <Stat
                label="Aufstieg"
                value={metricValue(data.ascent)}
                unit="m"
                accent={accent}
              />
            </div>
          </div>
        </div>

        {/* Accent hairline frame */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            border: `1px solid ${dimAccent}`,
          }}
        />
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
