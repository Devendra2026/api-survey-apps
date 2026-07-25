import {
  ALLOWED_IMAGE_MIME_TYPES,
  DEFAULT_MAX_IMAGE_BYTES,
} from "../domain/types.js"

export interface ImageValidationResult {
  ok: boolean
  mimeType?: string
  sizeBytes?: number
  error?: string
}

export function validateImageBuffer(
  buffer: Buffer,
  declaredMime?: string | null,
  maxBytes = DEFAULT_MAX_IMAGE_BYTES
): ImageValidationResult {
  if (!buffer || buffer.byteLength === 0) {
    return { ok: false, error: "Empty image buffer" }
  }
  if (buffer.byteLength > maxBytes) {
    return {
      ok: false,
      error: `Image exceeds max size (${buffer.byteLength} > ${maxBytes})`,
      sizeBytes: buffer.byteLength,
    }
  }

  const detected = detectMimeFromMagic(buffer) ?? declaredMime?.split(";")[0]?.trim().toLowerCase()
  if (!detected) {
    return { ok: false, error: "Unable to detect image MIME type", sizeBytes: buffer.byteLength }
  }

  const normalized = detected === "image/jpg" ? "image/jpeg" : detected
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(normalized as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return {
      ok: false,
      error: `MIME type not allowed: ${normalized}`,
      mimeType: normalized,
      sizeBytes: buffer.byteLength,
    }
  }

  return { ok: true, mimeType: normalized, sizeBytes: buffer.byteLength }
}

function detectMimeFromMagic(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png"
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp"
  }
  // HEIC/HEIF — ftyp box
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12)
    if (["heic", "heif", "mif1", "msf1"].includes(brand)) return "image/heic"
  }
  return null
}
