import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const PUBLIC_DIR = join(process.cwd(), "public");
const BRAND = "#FF5B3A";
const BG_DARK = "#1C1917";

function iconSvg(size: number, opts: { maskable?: boolean } = {}) {
  const padding = opts.maskable ? Math.round(size * 0.18) : Math.round(size * 0.12);
  const inner = size - padding * 2;
  const stroke = Math.max(2, Math.round(inner * 0.09));
  const radius = opts.maskable ? 0 : Math.round(size * 0.22);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${BG_DARK}"/>
  <g transform="translate(${padding} ${padding}) scale(${inner / 24})" fill="none" stroke="${BRAND}" stroke-width="${(stroke / inner) * 24}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  </g>
</svg>`;
}

async function writePng(name: string, size: number, maskable = false) {
  const svg = Buffer.from(iconSvg(size, { maskable }));
  await sharp(svg).png().toFile(join(PUBLIC_DIR, name));
  console.log(`wrote public/${name}`);
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });
  await writePng("icon-192.png", 192);
  await writePng("icon-512.png", 512);
  await writePng("icon-maskable-512.png", 512, true);
  await writePng("apple-touch-icon.png", 180);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
