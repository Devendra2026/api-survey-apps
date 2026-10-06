import { describe, expect, it } from "@jest/globals"
import type { ConfigService } from "@nestjs/config"
import type { Reflector } from "@nestjs/core"
import type { ThrottlerModuleOptions, ThrottlerStorage } from "@nestjs/throttler"
import { UserThrottlerGuard } from "./user-throttler.guard.js"

function guardFor(env: Record<string, string | undefined>): UserThrottlerGuard {
  const config = {
    get: (key: string) => env[key],
  } as unknown as ConfigService
  return new UserThrottlerGuard([] as ThrottlerModuleOptions, {} as ThrottlerStorage, {} as Reflector, config)
}

describe("UserThrottlerGuard", () => {
  it("tracks authenticated users independently of a shared proxy address", async () => {
    const guard = guardFor({ NODE_ENV: "production" })
    const tracker = (
      guard as unknown as { getTracker: (req: Record<string, unknown>) => Promise<string> }
    ).getTracker.bind(guard)
    const shared = { ip: "172.18.0.5" }
    const surveyorA = await tracker({ ...shared, user: { id: "user-a" } })
    const surveyorB = await tracker({ ...shared, user: { id: "user-b" } })
    expect(surveyorA).toBe("user:user-a")
    expect(surveyorB).toBe("user:user-b")
  })

  it("separates dev surveyors who present different identities from the same IP", async () => {
    const guard = guardFor({ NODE_ENV: "test", ALLOW_DEV_AUTH: "true" })
    const tracker = (
      guard as unknown as { getTracker: (req: Record<string, unknown>) => Promise<string> }
    ).getTracker.bind(guard)
    const surveyorA = await tracker({
      ip: "10.0.0.8",
      headers: { authorization: "Bearer dev:surveyor-a" },
    })
    const surveyorB = await tracker({
      ip: "10.0.0.8",
      headers: { authorization: "Bearer dev:surveyor-b" },
    })
    expect(surveyorA).toBe("user:surveyor-a")
    expect(surveyorB).toBe("user:surveyor-b")
  })

  it("does not honor dev tokens in production, so they share the client IP bucket", async () => {
    const guard = guardFor({ NODE_ENV: "production", ALLOW_DEV_AUTH: "true" })
    const tracker = (
      guard as unknown as { getTracker: (req: Record<string, unknown>) => Promise<string> }
    ).getTracker.bind(guard)
    const surveyorA = await tracker({
      ip: "203.0.113.4",
      headers: { authorization: "Bearer dev:surveyor-a" },
    })
    const surveyorB = await tracker({
      ip: "203.0.113.4",
      headers: { authorization: "Bearer dev:surveyor-b" },
    })
    expect(surveyorA).toBe("ip:203.0.113.4")
    expect(surveyorB).toBe(surveyorA)
  })
})
