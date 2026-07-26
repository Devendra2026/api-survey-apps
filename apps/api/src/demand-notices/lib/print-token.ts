import { createHmac, timingSafeEqual } from "node:crypto"

export type DemandNoticePrintClaims = {
  surveyId?: string
  wardId?: string
  assessmentYearId?: string
  exp: number
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input
  return buf.toString("base64url")
}

function fromB64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8")
}

export function signPrintToken(claims: DemandNoticePrintClaims, secret: string): string {
  const payload = b64url(JSON.stringify(claims))
  const sig = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${sig}`
}

export function verifyPrintToken(token: string, secret: string): DemandNoticePrintClaims {
  const [payload, sig] = token.split(".")
  if (!payload || !sig) {
    throw new Error("Invalid print token")
  }
  const expected = createHmac("sha256", secret).update(payload).digest("base64url")
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid print token signature")
  }
  const claims = JSON.parse(fromB64url(payload)) as DemandNoticePrintClaims
  if (!claims.exp || Date.now() > claims.exp) {
    throw new Error("Print token expired")
  }
  return claims
}

export const PRINT_TOKEN_TTL_MS = 15 * 60 * 1000
export const DEMAND_NOTICE_WARD_PDF_MAX = 200
