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
  try {
    const data = await exifr.parse(file, { gps: true });
    if (!data) return EMPTY_EXIF;
    const lat = typeof data.latitude === "number" ? data.latitude : null;
    const lng = typeof data.longitude === "number" ? data.longitude : null;
    const taken =
      data.DateTimeOriginal instanceof Date ? data.DateTimeOriginal : null;
    return { lat, lng, takenAt: taken ? taken.toISOString() : null };
  } catch {
    return EMPTY_EXIF;
  }
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
