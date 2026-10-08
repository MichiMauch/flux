/**
 * Story-Designs der Share-Karte (1080×1920).
 *
 * Instagram und WhatsApp legen oben Fortschrittsbalken, Profilbild und Name
 * und unten Antwortfeld, Reaktionen und eine allfällige Bildunterschrift über
 * das Bild. Meta empfiehlt für Stories 250 px oben und 340 px unten frei zu
 * lassen; für WhatsApp Status gibt es keine offizielle Vorgabe, gängig sind
 * unten bis 400 px. Wir nehmen jeweils den grösseren Wert — in diesen Zonen
 * steht in keinem Design Text.
 *
 * Alles hier läuft durch Satori (next/og): jedes Element mit mehreren Kindern
 * braucht display:flex, Fragmente und CSS-Grid gibt es nicht.
 */
import { routeToPath, type RoutePoint } from "./route-path";

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
export const STORY_SAFE_TOP = 250;
export const STORY_SAFE_BOTTOM = 400;

export const STORY_DESIGNS = ["karte", "sticker", "rahmen", "foto"] as const;
export type StoryDesign = (typeof STORY_DESIGNS)[number];

export function parseStoryDesign(raw: string | null): StoryDesign {
  return (STORY_DESIGNS as readonly string[]).includes(raw ?? "")
    ? (raw as StoryDesign)
    : "karte";
}

export interface StoryStat {
  label: string;
  value: string;
  unit?: string;
}

export interface StoryCardProps {
  accent: string;
  typeLabel: string;
  dateLabel: string;
  ownerLabel: string;
  title: string;
  stats: StoryStat[];
  /** Karte in der Grösse aus storyMapRequest(), als Data-URL. */
  mapUrl: string | null;
  /** Foto der Aktivität, bereits auf 1080×1920 zugeschnitten. */
  photoUrl: string | null;
  route: RoutePoint[] | null;
  isFlight: boolean;
}

const FONT = "JetBrains Mono, Menlo, monospace";
const WORDMARK = "FLUX";
const SIDE = 72;
// Abstand des Textes zur unteren Sperrzone.
const BOTTOM = STORY_SAFE_BOTTOM + 24;

/**
 * Welche Karte ein Design braucht: Grösse in Karten-Pixeln und Innenabstand
 * (oben, rechts, unten, links), in den die Route eingepasst wird. `null`, wenn
 * das Design ohne Kartenbild auskommt.
 */
export function storyMapRequest(design: StoryDesign): {
  width: number;
  height: number;
  padding: [number, number, number, number];
} | null {
  if (design === "karte") {
    // Die Route gehört in den freien Streifen zwischen oberer Sperrzone und
    // Textblock (~440 px hoch), sonst verschwindet sie unter Titel und Werten.
    return {
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      padding: [STORY_SAFE_TOP + 70, 110, BOTTOM + 500, 110],
    };
  }
  if (design === "rahmen") {
    return {
      width: RAHMEN_CARD,
      height: RAHMEN_CARD,
      padding: [90, 90, 250, 90],
    };
  }
  return null;
}

function titleSize(title: string, base: number): number {
  if (title.length > 34) return Math.round(base * 0.72);
  if (title.length > 22) return Math.round(base * 0.85);
  return base;
}

function RouteLine({
  route,
  size,
  color,
  width = 10,
}: {
  route: RoutePoint[] | null;
  size: { w: number; h: number };
  color: string;
  width?: number;
}) {
  const d = routeToPath(route, size.w, size.h, 24, 240);
  if (!d) return <div style={{ display: "flex", width: size.w, height: 0 }} />;
  return (
    <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
      {/* Dunkler Saum, damit die Linie auch auf hellen Fotos steht. */}
      <path
        d={d}
        fill="none"
        stroke="rgba(0,0,0,0.38)"
        strokeWidth={width + 8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Wordmark({ accent, owner, size = 30 }: { accent: string; owner: string; size?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size * 0.5,
        fontSize: size,
        letterSpacing: "0.26em",
        textTransform: "uppercase",
        textShadow: "0 1px 8px rgba(0,0,0,0.7)",
      }}
    >
      <div style={{ display: "flex", color: accent, fontWeight: 700 }}>{WORDMARK}</div>
      <div style={{ display: "flex", color: "rgba(255,255,255,0.75)" }}>{owner}</div>
    </div>
  );
}

/** Wert mit Einheit, linksbündig — für Blöcke unten links. */
function StatLeft({ stat, accent, valueSize }: { stat: StoryStat; accent: string; valueSize: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          fontSize: Math.round(valueSize * 0.32),
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.7)",
        }}
      >
        {stat.label}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <div style={{ display: "flex", fontSize: valueSize, lineHeight: 1, fontWeight: 700 }}>
          {stat.value}
        </div>
        {stat.unit ? (
          <div
            style={{
              display: "flex",
              fontSize: Math.round(valueSize * 0.36),
              marginBottom: Math.round(valueSize * 0.11),
              color: accent,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {stat.unit}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Wert mit Einheit, zentriert und gestapelt — für Sticker. */
function StatCentered({ stat, valueSize }: { stat: StoryStat; valueSize: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        style={{
          display: "flex",
          fontSize: Math.round(valueSize * 0.34),
          color: "rgba(255,255,255,0.92)",
          textShadow: "0 1px 10px rgba(0,0,0,0.6)",
        }}
      >
        {stat.label}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: valueSize,
          lineHeight: 1,
          fontWeight: 700,
          textShadow: "0 2px 16px rgba(0,0,0,0.6)",
        }}
      >
        {stat.unit ? `${stat.value} ${stat.unit}` : stat.value}
      </div>
    </div>
  );
}

function Root({
  children,
  background,
}: {
  children: React.ReactNode;
  background?: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        color: "white",
        fontFamily: FONT,
        ...(background ? { background } : {}),
      }}
    >
      {children}
    </div>
  );
}

function FullImage({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={STORY_WIDTH}
      height={STORY_HEIGHT}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  );
}

function PlayButton({ top, height }: { top: number; height: number }) {
  const size = 220;
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        top,
        left: 0,
        right: 0,
        height,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: 999,
          background: "rgba(0,0,0,0.42)",
          border: "4px solid rgba(255,255,255,0.92)",
          boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
        }}
      >
        <svg width={92} height={92} viewBox="0 0 100 100">
          <polygon points="32,20 82,50 32,80" fill="#ffffff" />
        </svg>
      </div>
    </div>
  );
}

function Pill({ accent, label }: { accent: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 22px",
        height: 52,
        borderRadius: 999,
        border: `1px solid ${accent}`,
        background: `${accent}33`,
        color: "#fff",
        fontSize: 23,
        letterSpacing: "0.16em",
        textShadow: "0 1px 6px rgba(0,0,0,0.6)",
      }}
    >
      {label}
    </div>
  );
}

// ── Karte: vollflächige Karte, ein kompakter Block mit allem ────────────────

function KarteDesign(p: StoryCardProps) {
  const fallback = !p.mapUrl
    ? routeToPath(p.route, STORY_WIDTH, STORY_SAFE_TOP + 70 + 700, 110)
    : null;
  return (
    <Root background="linear-gradient(160deg, #0a0a0a 0%, #111 55%, #0a0a0a 100%)">
      {p.mapUrl ? (
        <FullImage src={p.mapUrl} />
      ) : fallback ? (
        <svg
          width={STORY_WIDTH}
          height={STORY_HEIGHT}
          viewBox={`0 0 ${STORY_WIDTH} ${STORY_HEIGHT}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <path d={fallback} fill="none" stroke="#fff" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
          <path d={fallback} fill="none" stroke={p.accent} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}

      {/* Verlauf hinter dem Block, läuft dunkel bis zum unteren Rand durch —
          dort liegt die Bedienoberfläche der App auf einer ruhigen Fläche. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 1180,
          background:
            "linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.86) 36%, rgba(0,0,0,0.7) 68%, rgba(0,0,0,0) 100%)",
        }}
      />

      {p.isFlight ? <PlayButton top={STORY_SAFE_TOP} height={700} /> : null}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 28,
          position: "absolute",
          left: SIDE,
          right: SIDE,
          bottom: BOTTOM,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Pill accent={p.accent} label={p.isFlight ? `▶ 3D-FLUG` : p.typeLabel} />
            <div
              style={{
                display: "flex",
                fontSize: 23,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {p.dateLabel}
            </div>
          </div>
          <Wordmark accent={p.accent} owner={p.ownerLabel} size={22} />
        </div>

        <div
          style={{
            display: "flex",
            fontSize: titleSize(p.title, 86),
            lineHeight: 0.96,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
            textShadow: "0 2px 22px rgba(0,0,0,0.75)",
          }}
        >
          {p.title}
        </div>

        <div style={{ display: "flex", flexDirection: "row", gap: 56 }}>
          {p.stats.map((s) => (
            <StatLeft key={s.label} stat={s} accent={p.accent} valueSize={66} />
          ))}
        </div>
      </div>
    </Root>
  );
}

// ── Sticker: transparent, zum Einfügen über ein eigenes Foto ────────────────

function StickerDesign(p: StoryCardProps) {
  return (
    <Root>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 54,
          position: "absolute",
          top: STORY_SAFE_TOP,
          bottom: STORY_SAFE_BOTTOM,
          left: 0,
          right: 0,
        }}
      >
        {p.stats.map((s) => (
          <StatCentered key={s.label} stat={s} valueSize={104} />
        ))}
        <RouteLine route={p.route} size={{ w: 460, h: 400 }} color={p.accent} width={11} />
        <div
          style={{
            display: "flex",
            fontSize: 58,
            fontWeight: 700,
            letterSpacing: "0.3em",
            // letter-spacing hängt auch am letzten Buchstaben an — ausgleichen,
            // sonst sitzt die Wortmarke optisch links von der Mitte.
            paddingLeft: "0.3em",
            textShadow: "0 2px 16px rgba(0,0,0,0.6)",
          }}
        >
          {WORDMARK}
        </div>
      </div>
    </Root>
  );
}

// ── Rahmen: Karte als Kachel auf dunklem Grund mit Farbstreifen ─────────────

const RAHMEN_CARD = 900;

function RahmenDesign(p: StoryCardProps) {
  const cardTop = STORY_SAFE_TOP + 50;
  const stripe = (top: number) => ({
    display: "flex" as const,
    position: "absolute" as const,
    left: -400,
    top,
    width: 1900,
    height: 150,
    background: p.accent,
    transform: "rotate(-32deg)",
  });
  return (
    <Root background="#0c0c0c">
      <div style={stripe(430)} />
      <div style={stripe(1180)} />

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: cardTop,
          left: (STORY_WIDTH - RAHMEN_CARD) / 2,
          width: RAHMEN_CARD,
          height: RAHMEN_CARD,
          borderRadius: 64,
          overflow: "hidden",
          background: "#161616",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        {p.mapUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.mapUrl}
            alt=""
            width={RAHMEN_CARD}
            height={RAHMEN_CARD}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 200,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RouteLine route={p.route} size={{ w: 700, h: 600 }} color={p.accent} width={12} />
          </div>
        )}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 360,
            background:
              "linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 60,
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 48,
          }}
        >
          {p.stats.map((s) => (
            <div
              key={s.label}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
            >
              <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.8)" }}>
                {s.label}
              </div>
              <div style={{ display: "flex", fontSize: 54, lineHeight: 1, fontWeight: 700 }}>
                {s.unit ? `${s.value} ${s.unit}` : s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Titel und Wortmarke unter der Kachel, über der unteren Sperrzone. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          position: "absolute",
          top: cardTop + RAHMEN_CARD + 44,
          bottom: BOTTOM,
          left: SIDE,
          right: SIDE,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              textAlign: "center",
              fontSize: titleSize(p.title, 70),
              lineHeight: 1,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              textShadow: "0 2px 18px rgba(0,0,0,0.8)",
            }}
          >
            {p.title}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.75)",
              textShadow: "0 1px 10px rgba(0,0,0,0.8)",
            }}
          >
            {`${p.typeLabel} · ${p.dateLabel}`}
          </div>
        </div>
        <Wordmark accent="#fff" owner={p.ownerLabel} size={34} />
      </div>
    </Root>
  );
}

// ── Foto: eigenes Foto der Aktivität, Route und Werte darüber ───────────────

function FotoDesign(p: StoryCardProps) {
  return (
    <Root background="linear-gradient(160deg, #0a0a0a 0%, #1a1a1a 55%, #0a0a0a 100%)">
      {p.photoUrl ? <FullImage src={p.photoUrl} /> : null}
      {/* Leichte Abdunklung, damit weisse Schrift auf hellem Himmel steht. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.16) 40%, rgba(0,0,0,0.2) 62%, rgba(0,0,0,0.78) 100%)",
        }}
      />

      {/* Zusätzlich von links, hinter der Wertespalte. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 640,
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0) 100%)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 34,
          position: "absolute",
          top: STORY_SAFE_TOP + 40,
          left: SIDE,
        }}
      >
        <Wordmark accent={p.accent} owner={p.ownerLabel} size={30} />
        {p.stats.map((s) => (
          <StatLeft key={s.label} stat={s} accent={p.accent} valueSize={78} />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: STORY_SAFE_TOP + 300,
          right: 40,
        }}
      >
        <RouteLine route={p.route} size={{ w: 600, h: 720 }} color="#ffffff" width={9} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          position: "absolute",
          left: SIDE,
          right: SIDE,
          bottom: BOTTOM,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: titleSize(p.title, 80),
            lineHeight: 0.98,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
            textShadow: "0 2px 22px rgba(0,0,0,0.8)",
          }}
        >
          {p.title}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.85)",
            textShadow: "0 1px 10px rgba(0,0,0,0.8)",
          }}
        >
          {`${p.typeLabel} · ${p.dateLabel}`}
        </div>
      </div>
    </Root>
  );
}

function Guides() {
  const zone = (edge: "top" | "bottom", height: number) => (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: 0,
        right: 0,
        [edge]: 0,
        height,
        background: "rgba(255,0,0,0.35)",
      }}
    />
  );
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {zone("top", STORY_SAFE_TOP)}
      {zone("bottom", STORY_SAFE_BOTTOM)}
    </div>
  );
}

export function StoryCard({
  design,
  showGuides,
  ...props
}: StoryCardProps & { design: StoryDesign; showGuides: boolean }) {
  const Design =
    design === "sticker"
      ? StickerDesign
      : design === "rahmen"
        ? RahmenDesign
        : design === "foto"
          ? FotoDesign
          : KarteDesign;
  return (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%" }}>
      <Design {...props} />
      {/* ?guides=1 blendet die überdeckten Zonen rot ein, zum Prüfen. */}
      {showGuides ? <Guides /> : null}
    </div>
  );
}
