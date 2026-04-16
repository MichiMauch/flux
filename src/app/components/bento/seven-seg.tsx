// 7-segment digit rendering (SVG). Segments labelled a..g.
// Digit viewBox: 60 x 100
const SEG_MAP: Record<string, string[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
  "-": ["g"],
  " ": [],
};

function horizSeg(cx: number, cy: number, w: number, t: number): string {
  const h = w / 2;
  const th = t / 2;
  return [
    [cx - h, cy],
    [cx - h + th, cy - th],
    [cx + h - th, cy - th],
    [cx + h, cy],
    [cx + h - th, cy + th],
    [cx - h + th, cy + th],
  ]
    .map((p) => p.join(","))
    .join(" ");
}

function vertSeg(cx: number, cy: number, h: number, t: number): string {
  const hh = h / 2;
  const th = t / 2;
  return [
    [cx, cy - hh],
    [cx + th, cy - hh + th],
    [cx + th, cy + hh - th],
    [cx, cy + hh],
    [cx - th, cy + hh - th],
    [cx - th, cy - hh + th],
  ]
    .map((p) => p.join(","))
    .join(" ");
}

export function SevenSegDigit({
  char,
  on,
  off,
}: {
  char: string;
  on: string;
  off: string;
}) {
  const t = 9;
  const hW = 40;
  const vH = 40;
  const segs: Record<string, string> = {
    a: horizSeg(30, 6, hW, t),
    g: horizSeg(30, 50, hW, t),
    d: horizSeg(30, 94, hW, t),
    f: vertSeg(6, 28, vH, t),
    b: vertSeg(54, 28, vH, t),
    e: vertSeg(6, 72, vH, t),
    c: vertSeg(54, 72, vH, t),
  };
  const active = SEG_MAP[char] ?? [];
  return (
    <svg viewBox="-2 -2 64 104" width="0.6em" height="1em" style={{ overflow: "visible" }}>
      {Object.entries(segs).map(([k, pts]) => {
        const isOn = active.includes(k);
        return (
          <polygon
            key={k}
            points={pts}
            fill={isOn ? on : off}
            style={
              isOn
                ? { filter: `drop-shadow(0 0 4px ${on}) drop-shadow(0 0 8px ${on}aa)` }
                : undefined
            }
          />
        );
      })}
    </svg>
  );
}

export function SevenSegColon({ on }: { on: string }) {
  return (
    <svg viewBox="-2 -2 20 104" width="0.22em" height="1em" style={{ overflow: "visible" }}>
      <circle cx="8" cy="36" r="5" fill={on} style={{ filter: `drop-shadow(0 0 4px ${on})` }} />
      <circle cx="8" cy="64" r="5" fill={on} style={{ filter: `drop-shadow(0 0 4px ${on})` }} />
    </svg>
  );
}

export function SevenSegDot({ on }: { on: string }) {
  return (
    <svg viewBox="-2 -2 20 104" width="0.22em" height="1em" style={{ overflow: "visible" }}>
      <rect x="3" y="87" width="10" height="10" fill={on} style={{ filter: `drop-shadow(0 0 4px ${on})` }} />
    </svg>
  );
}

export function SevenSegApos({ on }: { on: string }) {
  return (
    <svg viewBox="-2 -2 14 104" width="0.14em" height="1em" style={{ overflow: "visible" }}>
      <rect x="3" y="8" width="6" height="14" fill={on} style={{ filter: `drop-shadow(0 0 4px ${on})` }} />
    </svg>
  );
}

export function SevenSegDisplay({
  value,
  on = "#ffffff",
  off = "#1a1a1a",
}: {
  value: string;
  on?: string;
  off?: string;
}) {
  return (
    <span className="inline-flex items-center gap-[0.08em] leading-none align-baseline">
      {value.split("").map((ch, i) => {
        if (ch === ":") return <SevenSegColon key={i} on={on} />;
        if (ch === "." || ch === ",") return <SevenSegDot key={i} on={on} />;
        if (ch === "'" || ch === "\u2019") return <SevenSegApos key={i} on={on} />;
        return <SevenSegDigit key={i} char={ch} on={on} off={off} />;
      })}
    </span>
  );
}
