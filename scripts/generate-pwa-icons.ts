import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const PUBLIC_DIR = join(process.cwd(), "public");
const SOURCE_SVG = join(PUBLIC_DIR, "icon.svg");
const BADGE_SVG = join(PUBLIC_DIR, "badge.svg");
const BG_DARK = "#1C1917";

async function loadSourceSvg(): Promise<string> {
  return readFile(SOURCE_SVG, "utf8");
}

async function loadBadgeSvg(): Promise<string> {
  return readFile(BADGE_SVG, "utf8");
}

function maskableSvg(source: string, size: number): string {
  // Maskable icons need a safe-zone padding (~10% on each side) and a
  // full-bleed background so platforms can crop them into any shape.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG_DARK}"/>
  <g transform="translate(${size * 0.1} ${size * 0.1}) scale(${(size * 0.8) / size})">
    ${source}
  </g>
</svg>`;
}

async function writePng(name: string, size: number, svg: string) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(PUBLIC_DIR, name));
  console.log(`wrote public/${name}`);
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });
  const source = await loadSourceSvg();
  await writePng("icon-192.png", 192, source);
  await writePng("icon-512.png", 512, source);
  await writePng("icon-maskable-512.png", 512, maskableSvg(source, 512));
  await writePng("apple-touch-icon.png", 180, source);

  // Android notification badge: monochrome silhouette on transparent bg.
  // Android ignores colors and applies only the alpha channel, so a fully
  // opaque colored PNG would render as a plain white square.
  const badge = await loadBadgeSvg();
  await writePng("badge-96.png", 96, badge);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
