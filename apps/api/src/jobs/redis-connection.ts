import type { RedisOptions } from "ioredis"

export function redisConnectionOptions(redisUrl?: string): RedisOptions {
  const normalizedUrl = redisUrl?.trim()
  if (!normalizedUrl) {
    throw new Error(
      "REDIS_URL is not configured. Redis is required for BullMQ queues. " +
        "Start Docker Compose or set REDIS_URL=redis://localhost:6379 for local development."
    )
  }

  const parsed = new URL(normalizedUrl)
  const db = parsed.pathname ? Number.parseInt(parsed.pathname.replace("/", ""), 10) : undefined

  return {
    host: parsed.hostname || "localhost",
    port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: Number.isFinite(db) ? db : undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    connectTimeout: 5_000,
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      if (times > 10) return null
      return Math.min(times * 500, 5_000)
    },
  }
}
