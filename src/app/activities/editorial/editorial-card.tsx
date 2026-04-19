"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { activityTypeColor, activityTypeLabel } from "@/lib/activity-types";
import { rajdhani, spaceMono } from "../../components/bento/bento-fonts";
import { RouteSvg } from "./route-svg";
import type { ActivityFeedItem } from "../actions";

export type CardSize = "hero" | "medium" | "small";

interface Props {
  a: ActivityFeedItem;
  size: CardSize;
  /** SVG/text orientation for medium/small. Hero always stacks vertically. */
  mirror: boolean;
  /** Index used to stagger the reveal animation. */
  revealIndex: number;
}

function formatDistanceKm(meters: number): string {
  return (meters / 1000).toFixed(meters >= 10000 ? 1 : 2);
}

function formatDurationShort(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`;
  return `${m}min`;
}

function formatPaceMinPerKm(distM: number, timeS: number): string | null {
  if (!distM || !timeS) return null;
  const secPerKm = timeS / (distM / 1000);
  if (!isFinite(secPerKm) || secPerKm < 60 || secPerKm > 60 * 60) return null;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

function hourGradient(hour: number): string {
  // soft warm → blue → peach → violet → deep blue
  if (hour >= 5 && hour < 10) return "#FFB24D"; // morning
  if (hour >= 10 && hour < 14) return "#7FB6FF"; // midday
  if (hour >= 14 && hour < 18) return "#FF8E7A"; // afternoon
  if (hour >= 18 && hour < 22) return "#8A5BFF"; // evening
  return "#1E2A78"; // night
}

/** Noise overlay (fractalNoise → tiling texture, base64-free) */
const NOISE_URI =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const SIZE_CFG: Record<
  CardSize,
  {
    minH: string;
    title: string;
    padding: string;
    stroke: number;
    metricFs: string;
  }
> = {
  hero: {
    minH: "clamp(420px, 56vw, 640px)",
    title: "clamp(44px, 6.4vw, 104px)",
    padding: "clamp(24px, 3vw, 48px)",
    stroke: 12,
    metricFs: "12px",
  },
  medium: {
    minH: "clamp(300px, 34vw, 440px)",
    title: "clamp(26px, 3.2vw, 52px)",
    padding: "clamp(18px, 2vw, 28px)",
    stroke: 14,
    metricFs: "11px",
  },
  small: {
    minH: "clamp(240px, 28vw, 340px)",
    title: "clamp(20px, 2.2vw, 34px)",
    padding: "14px",
    stroke: 16,
    metricFs: "10px",
  },
};

export function EditorialCard({ a, size, mirror, revealIndex }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const color = activityTypeColor(a.type);
  const cfg = SIZE_CFG[size];
  const hasRoute =
    Array.isArray(a.routeData) && (a.routeData as unknown[]).length >= 2;
  const start = new Date(a.startTime);
  const hour = start.getHours();
  const gradientColor = hourGradient(hour);
  const activeDuration = a.movingTime ?? a.duration;
  const pace =
    (a.type.toUpperCase().includes("RUN") ||
      a.type.toUpperCase().includes("WALK") ||
      a.type.toUpperCase().includes("HIK")) &&
    a.distance &&
    activeDuration
      ? formatPaceMinPerKm(a.distance, activeDuration)
      : null;

  const dateLabel = start
    .toLocaleDateString("de-CH", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
  const timeLabel = start.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      el.dataset.inView = "true";
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.dataset.inView = "true";
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -5% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const isHero = size === "hero";
  const layout: React.CSSProperties = isHero
    ? {
        display: "grid",
        gridTemplateRows: "1fr auto",
      }
    : {
        display: "grid",
        gridTemplateColumns: mirror ? "1fr 1.1fr" : "1.1fr 1fr",
      };

  const svgArea: React.CSSProperties = isHero
    ? { gridRow: "1 / 2", gridColumn: "1 / -1" }
    : { gridColumn: mirror ? "2 / 3" : "1 / 2" };

  const textArea: React.CSSProperties = isHero
    ? { gridRow: "1 / 3", gridColumn: "1 / -1", pointerEvents: "none" }
    : {
        gridColumn: mirror ? "1 / 2" : "2 / 3",
        gridRow: "1 / 2",
      };

  return (
    <article
      className="editorial-card relative"
      style={{ ["--sport" as string]: color }}
    >
      <Link
        ref={ref}
        href={`/activity/${a.id}`}
        className="group relative block overflow-hidden rounded-[6px] isolate"
        data-reveal-index={revealIndex}
        style={{
          minHeight: cfg.minH,
          backgroundColor: "#141414",
          border: "1px solid #242424",
          ...layout,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(120% 90% at ${mirror ? "85% 20%" : "15% 20%"}, ${gradientColor}22 0%, transparent 60%)`,
            mixBlendMode: "screen",
            zIndex: 0,
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.08]"
          style={{
            backgroundImage: NOISE_URI,
            backgroundSize: "180px 180px",
            zIndex: 1,
          }}
        />

        {hasRoute && (
          <div
            className="relative"
            style={{ ...svgArea, zIndex: 2 }}
          >
            <RouteSvg
              route={a.routeData}
              color={color}
              strokeWidth={cfg.stroke}
              className="route-svg h-full w-full"
              glow={isHero ? 0.65 : 0.55}
            />
          </div>
        )}

        {!hasRoute && (
          <div
            className="relative flex items-center justify-center"
            style={{ ...svgArea, zIndex: 2, padding: cfg.padding }}
          >
            <div
              className={`${rajdhani.className} leading-none tracking-[-0.03em] font-bold opacity-80`}
              style={{
                fontSize: isHero
                  ? "clamp(96px, 18vw, 240px)"
                  : "clamp(64px, 9vw, 140px)",
                color,
                textShadow: `0 0 18px ${color}55, 0 0 40px ${color}33`,
              }}
            >
              {a.distance != null ? formatDistanceKm(a.distance) : "—"}
              <span
                className={`${spaceMono.className} align-top ml-2 text-[0.22em] tracking-[0.18em]`}
                style={{ color: "#a3a3a3" }}
              >
                KM
              </span>
            </div>
          </div>
        )}

        <div
          className="relative flex flex-col justify-between"
          style={{
            ...textArea,
            padding: cfg.padding,
            zIndex: 3,
          }}
        >
          <header className="reveal reveal-1">
            <div
              className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.22em]`}
              style={{ color: "#9a9a9a" }}
            >
              <span style={{ color }}>●</span>{" "}
              {activityTypeLabel(a.type)} · {dateLabel} · {timeLabel}
            </div>
          </header>

          <h3
            className={`${rajdhani.className} reveal reveal-2 font-bold uppercase leading-[0.88] tracking-[-0.025em] mt-4`}
            style={{
              fontSize: cfg.title,
              color: "#f4f4f4",
              maxWidth: "18ch",
              textShadow: `0 2px 24px rgba(0,0,0,0.6)`,
            }}
          >
            {a.name}
          </h3>

          <footer
            className={`${spaceMono.className} reveal reveal-3 mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2`}
            style={{
              fontSize: cfg.metricFs,
              color: "#cfcfcf",
              letterSpacing: "0.12em",
            }}
          >
            {a.distance != null && (
              <Meta
                label="DIST"
                value={`${formatDistanceKm(a.distance)} KM`}
                accent={color}
              />
            )}
            {activeDuration != null && activeDuration > 0 && (
              <Meta
                label="ZEIT"
                value={formatDurationShort(activeDuration)}
                accent={color}
              />
            )}
            <span className="hover-only flex items-baseline gap-x-5 gap-y-2 flex-wrap">
              {pace && <Meta label="PACE" value={pace} accent={color} />}
              {a.ascent != null && a.ascent > 0 && (
                <Meta
                  label="HM"
                  value={`${Math.round(a.ascent)} M`}
                  accent={color}
                />
              )}
              {a.avgHeartRate != null && (
                <Meta
                  label="HR"
                  value={`${a.avgHeartRate} BPM`}
                  accent={color}
                />
              )}
            </span>
          </footer>
        </div>
      </Link>
    </article>
  );
}

function Meta({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span style={{ color: "#6a6a6a" }}>{label}</span>
      <span style={{ color: accent, fontWeight: 700 }}>{value}</span>
    </span>
  );
}
