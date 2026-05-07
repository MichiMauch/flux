import sharp from "sharp";

// Allowed sharp-detected formats for user uploads. We rely on sharp's metadata
// probe to identify the actual content type (magic bytes) — the client-supplied
// MIME type / file extension is untrusted.
const ALLOWED_FORMATS = new Set([
  "jpeg",
  "png",
  "webp",
  "heif", // covers HEIC iPhone exports
  "gif",
  "avif",
]);

export class InvalidImageError extends Error {
  constructor(message = "Ungültiges Bildformat") {
    super(message);
    this.name = "InvalidImageError";
  }
}

/**
 * Verify that `buffer` is actually an image of an allowed type by inspecting
 * its content (sharp metadata). Throws `InvalidImageError` on rejection. The
 * caller is responsible for catching and converting to an HTTP response.
 */
export async function assertValidImageBuffer(buffer: Buffer): Promise<void> {
  let format: string | undefined;
  try {
    const meta = await sharp(buffer).metadata();
    format = meta.format;
  } catch {
    throw new InvalidImageError();
  }
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new InvalidImageError();
  }
}
