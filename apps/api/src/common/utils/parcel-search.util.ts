import { normalizeParcelKey } from "@workspace/validation"

/**
 * Zero-pad variants so "1", "0001" and "00001" all match regardless of
 * how the parcel number was stored (raw import vs padParcelNo on QC correct).
 */
export function parcelNumberVariants(search: string): string[] {
  const bare = normalizeParcelKey(search.replace(/\D/g, ""))
  if (!bare || !/^\d+$/.test(bare)) return []
  const out = new Set<string>([bare])
  for (let len = bare.length + 1; len <= 5; len++) {
    out.add(bare.padStart(len, "0"))
  }
  return [...out]
}
