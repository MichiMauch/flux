import exifr from "exifr";

export type PhotoExif = {
  lat: number | null;
  lng: number | null;
  takenAt: string | null;
};

export type PreparedPhoto = {
  file: File;
  exif: PhotoExif;
};

const EMPTY_EXIF: PhotoExif = { lat: null, lng: null, takenAt: null };

async function parseExif(file: File): Promise<PhotoExif> {
  let lat: number | null = null;
  let lng: number | null = null;
  let takenAt: string | null = null;

  try {
    const gps = await exifr.gps(file);
    if (
      gps &&
      typeof gps.latitude === "number" &&
      typeof gps.longitude === "number"
    ) {
      lat = gps.latitude;
      lng = gps.longitude;
    }
  } catch {
    // ignore
  }

  try {
    const data = await exifr.parse(file, { gps: true });
    if (data) {
      if (
        lat == null &&
        typeof (data as { latitude?: unknown }).latitude === "number"
      ) {
        lat = (data as { latitude: number }).latitude;
      }
      if (
        lng == null &&
        typeof (data as { longitude?: unknown }).longitude === "number"
      ) {
        lng = (data as { longitude: number }).longitude;
      }
      const taken = (data as { DateTimeOriginal?: unknown }).DateTimeOriginal;
      if (taken instanceof Date) {
        takenAt = taken.toISOString();
      } else if (typeof taken === "string") {
        const d = new Date(taken);
        if (!Number.isNaN(d.getTime())) takenAt = d.toISOString();
      }
    }
  } catch {
    // ignore
  }

  return { lat, lng, takenAt };
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/")) {
    return { file, exif: EMPTY_EXIF };
  }
  // Client-side compression is intentionally disabled: canvas re-encoding
  // strips EXIF (especially GPS), and the server already resizes to 2048 px
  // and converts to WebP via Sharp. Sending the original preserves EXIF
  // reliably and is the simpler, more correct path. EXIF is also extracted
  // client-side and sent as an override field, so even if the server's
  // buffer-EXIF parse misses something, the client values can fill in.
  const exif = await parseExif(file);
  return { file, exif };
}
