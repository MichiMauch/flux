import { SevenSegDisplay } from "./seven-seg";
import { spaceMono } from "./bento-fonts";

/**
 * Splits a mixed-content value like "7h 42m", "04:12", "81", "-" into
 * numeric runs (rendered via 7-segment display) and text runs (rendered in
 * a compact mono tag). Normalizes en/em-dashes to ASCII "-" so they land
 * in the LED 7-segment SEG_MAP.
 */
interface LedValueProps {
  value: string;
  color?: string;
  off?: string;
  textColor?: string;
}

const LED_CHAR = /[0-9:.,'\u2019\-–—]/;

function isLed(ch: string): boolean {
  return LED_CHAR.test(ch);
}

function normalize(ch: string): string {
  if (ch === "–" || ch === "—") return "-";
  return ch;
}

export function LedValue({
  value,
  color = "#ffffff",
  off = "#1a1a1a",
  textColor = "#a3a3a3",
}: LedValueProps) {
  const tokens: { kind: "led" | "txt"; s: string }[] = [];
  let cur: "led" | "txt" | null = null;
  let buf = "";
  for (const raw of value) {
    if (raw === " ") {
      if (cur === "txt") buf += raw;
      else if (buf && cur === "led") {
        tokens.push({ kind: "led", s: buf });
        buf = "";
        cur = null;
      }
      continue;
    }
    const ch = normalize(raw);
    const k: "led" | "txt" = isLed(ch) ? "led" : "txt";
    if (k !== cur) {
      if (buf) tokens.push({ kind: cur!, s: buf });
      cur = k;
      buf = ch;
    } else {
      buf += ch;
    }
  }
  if (buf && cur) tokens.push({ kind: cur, s: buf });

  return (
    <span className="inline-flex items-baseline leading-none">
      {tokens.map((t, i) =>
        t.kind === "led" ? (
          <SevenSegDisplay key={i} value={t.s} on={color} off={off} />
        ) : (
          <span
            key={i}
            className={`${spaceMono.className} font-bold uppercase ml-[0.15em]`}
            style={{
              fontSize: "0.42em",
              color: textColor,
              alignSelf: "flex-end",
              paddingBottom: "0.15em",
            }}
          >
            {t.s}
          </span>
        )
      )}
    </span>
  );
}
