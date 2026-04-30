import { readFile } from "fs/promises";
import exifr from "exifr";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/exif-diag.ts <path-to-jpeg>");
    process.exit(1);
  }

  const buffer = await readFile(file);
  console.log(`File: ${file}  size=${buffer.length}B`);
  console.log("");

  console.log("--- exifr.parse(buffer, true)  // every segment ---");
  try {
    const all = await exifr.parse(buffer, true);
    console.log(JSON.stringify(all, null, 2));
  } catch (e) {
    console.error("parse(true) failed:", e);
  }
  console.log("");

  console.log("--- exifr.parse(buffer, { gps: true }) ---");
  try {
    const gpsParse = await exifr.parse(buffer, { gps: true });
    console.log(JSON.stringify(gpsParse, null, 2));
  } catch (e) {
    console.error("parse({gps}) failed:", e);
  }
  console.log("");

  console.log("--- exifr.gps(buffer) ---");
  try {
    const gps = await exifr.gps(buffer);
    console.log(JSON.stringify(gps, null, 2));
  } catch (e) {
    console.error("gps() failed:", e);
  }
  console.log("");

  console.log(
    "--- exifr.parse(buffer, { ifd0: true, exif: true, gps: true, mergeOutput: false }) ---",
  );
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const struct = await exifr.parse(buffer, {
      ifd0: true,
      exif: true,
      gps: true,
      mergeOutput: false,
    } as any);
    console.log(JSON.stringify(struct, null, 2));
  } catch (e) {
    console.error("structured parse failed:", e);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
