import { createHmac } from "node:crypto"

export type PrintClaims = {
  surveyId?: string
  wardId?: string
  assessmentYearId?: string
  exp: number
}

export function signDemandNoticePrintToken(claims: PrintClaims, secret: string): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url")
  const sig = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${sig}`
}

export const PRINT_TOKEN_TTL_MS = 15 * 60 * 1000
