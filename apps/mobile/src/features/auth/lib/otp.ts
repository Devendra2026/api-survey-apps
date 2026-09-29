/** Shared OTP digit normalization for forms and tests. */
export function normalizeOtpDigits(raw: string, length = 6): string {
  return raw.replace(/\D/g, "").slice(0, length)
}

export function isCompleteOtpCode(code: string, length = 6): boolean {
  return normalizeOtpDigits(code, length).length === length
}
