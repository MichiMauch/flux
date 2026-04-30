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
const SKIP_COMPRESS_BELOW = 1.5 * 1024 * 1024;

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

  console.info("[photo-upload] EXIF parsed:", { lat, lng, takenAt });

  return { lat, lng, takenAt };
}

async function renderToBlob(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> {
  if (typeof OffscreenCanvas !== "undefined") {
    try {
      const off = new OffscreenCanvas(width, height);
      const ctx = off.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, width, height);
        return await off.convertToBlob({ type: "image/jpeg", quality });
      }
    } catch {
      // fall through to canvas fallback
    }
  }
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    } catch {
      resolve(null);
    }
  });
}

export async function preparePhoto(
  file: File,
  maxEdge: number = 2048,
  quality: number = 0.85,
): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/")) {
    return { file, exif: EMPTY_EXIF };
  }
  const exif = await parseExif(file);
  if (file.size < SKIP_COMPRESS_BELOW) {
    return { file, exif };
  }

  // Only re-encode (which strips EXIF) when we successfully read GPS
  // client-side. Otherwise pass the original through so the server can
  // extract GPS from the raw buffer. Correctness > bandwidth.
  if (exif.lat == null || exif.lng == null) {
    console.info(
      "[photo-upload] no GPS in client-side EXIF — uploading original to preserve metadata",
    );
    return { file, exif };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { file, exif };
  }

  const { width: w, height: h } = bitmap;
  if (w <= maxEdge && h <= maxEdge) {
    bitmap.close();
    return { file, exif };
  }

  const scale = maxEdge / Math.max(w, h);
  const targetW = Math.round(w * scale);
  const targetH = Math.round(h * scale);

  const blob = await renderToBlob(bitmap, targetW, targetH, quality);
  bitmap.close();
  if (!blob) return { file, exif };

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const compressed = new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
  return { file: compressed, exif };
}
