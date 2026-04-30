import { readFile } from "fs/promises";
import exifr from "exifr";
import * as piexif from "piexif-ts";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/exif-diag.ts <path-to-jpeg>");
    process.exit(1);
  }

  const buffer = await readFile(file);
  console.log(`File: ${file}  size=${buffer.length}B`);
  console.log("");

  console.log("--- exifr.parse(buffer, true) (subset) ---");
  try {
    const all = await exifr.parse(buffer, true);
    if (all) {
      console.log({
        latitude: all.latitude,
        longitude: all.longitude,
        GPSLatitude: all.GPSLatitude,
        GPSLatitudeRef: all.GPSLatitudeRef,
        GPSLongitude: all.GPSLongitude,
        GPSLongitudeRef: all.GPSLongitudeRef,
        DateTimeOriginal: all.DateTimeOriginal,
      });
    } else {
      console.log("(null)");
    }
  } catch (e) {
    console.error("parse(true) failed:", e);
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

  console.log("--- piexif.load(latin1 string) ---");
  try {
    const binStr = buffer.toString("binary");
    const exifObj = piexif.load(binStr);
    const gps = exifObj.GPS;
    if (gps) {
      const latRaw = gps[piexif.TagValues.GPSIFD.GPSLatitude];
      const latRef = gps[piexif.TagValues.GPSIFD.GPSLatitudeRef];
      const lngRaw = gps[piexif.TagValues.GPSIFD.GPSLongitude];
      const lngRef = gps[piexif.TagValues.GPSIFD.GPSLongitudeRef];
      console.log("raw:", { latRaw, latRef, lngRaw, lngRef });
      const lat =
        latRaw && latRef
          ? piexif.GPSHelper.dmsRationalToDeg(
              latRaw as number[][],
              latRef as string,
            )
          : null;
      const lng =
        lngRaw && lngRef
          ? piexif.GPSHelper.dmsRationalToDeg(
              lngRaw as number[][],
              lngRef as string,
            )
          : null;
      console.log("decimal:", { lat, lng });
    } else {
      console.log("no GPS section");
    }
  } catch (e) {
    console.error("piexif failed:", e);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
