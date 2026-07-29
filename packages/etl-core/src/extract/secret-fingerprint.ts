/**
 * Short, non-reversible fingerprint of an ETL secret.
 *
 * Must stay byte-for-byte identical to the implementation in the Convex backend
 * (`convex/etl/http.ts`) so operators can compare the two sides directly. 48 bits
 * of SHA-256 is enough to detect a mismatch and far too little to recover the
 * secret, which makes it safe to print in logs and error bodies.
 */
export async function fingerprintSecret(value: string): Promise<string> {
  if (value === "") return "empty"
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12)
}
