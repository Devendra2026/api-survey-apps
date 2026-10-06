/**
 * Removes credentials and URLs from text that may be written to logs.
 */
export function safeLogText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]")
    .slice(0, 240)
}
