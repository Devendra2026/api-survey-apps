/**
 * Throttle bucket key.
 * Authenticated surveyors each get their own bucket. Anonymous traffic shares by client IP.
 * The IP must already be Express `req.ip` after the Traefik trust-proxy setting.
 */
export function throttleTrackerKey(input: {
  userId: string | null | undefined
  ip: string | null | undefined
}): string {
  const userId = input.userId?.trim()
  if (userId) {
    return `user:${userId}`
  }
  const ip = input.ip?.trim()
  return `ip:${ip && ip.length > 0 ? ip : "unknown"}`
}

/**
 * Client address Express computed after `trust proxy`.
 * Prefer `req.ip` over the raw `X-Forwarded-For` list so an untrusted hop cannot choose the bucket.
 */
export function readClientIp(req: { ip?: unknown }): string {
  return typeof req.ip === "string" && req.ip.trim().length > 0 ? req.ip.trim() : "unknown"
}
