import { describe, expect, it } from "@jest/globals"
import { ConvexEtlHttpError } from "../extract/convex-etl-error.js"
import { classifyError, isFinalAttempt, isPermanentFailure } from "./retry-policy.js"

describe("isFinalAttempt", () => {
  it("is false while the queue still has retries left", () => {
    expect(isFinalAttempt({ attemptsMade: 0, maxAttempts: 3 })).toBe(false)
    expect(isFinalAttempt({ attemptsMade: 1, maxAttempts: 3 })).toBe(false)
  })

  it("is true on the last allowed attempt", () => {
    expect(isFinalAttempt({ attemptsMade: 2, maxAttempts: 3 })).toBe(true)
  })

  it("treats a missing attempt budget as a single attempt", () => {
    expect(isFinalAttempt({ attemptsMade: 0, maxAttempts: undefined })).toBe(true)
    expect(isFinalAttempt({ attemptsMade: 0, maxAttempts: 1 })).toBe(true)
  })

  it("stays true when attempts overshoot the budget", () => {
    expect(isFinalAttempt({ attemptsMade: 9, maxAttempts: 3 })).toBe(true)
  })
})

describe("classifyError with Convex ETL HTTP failures", () => {
  const unauthorized = (body: string, wwwAuthenticate?: string) =>
    new ConvexEtlHttpError({ path: "/etl/list-survey-ids", status: 401, body, wwwAuthenticate })

  it("never retries a rejected secret", () => {
    const error = unauthorized('{"error":"Unauthorized","reason":"secret_mismatch","providedFingerprint":"a1b2c3d4e5f6"}')
    expect(classifyError(error)).toBe("permanent")
    expect(error.isRetryable).toBe(false)
  })

  it("never retries a secret Convex does not have configured", () => {
    const error = new ConvexEtlHttpError({
      path: "/etl/count-surveys",
      status: 500,
      body: '{"error":"Server misconfigured","reason":"secret_not_configured"}',
    })
    expect(isPermanentFailure(error)).toBe(true)
  })

  it("still retries ordinary server errors", () => {
    const error = new ConvexEtlHttpError({ path: "/etl/count-surveys", status: 503, body: "upstream unavailable" })
    expect(classifyError(error)).toBe("transient")
  })

  it("reports which side produced the rejection", () => {
    const fromConvex = unauthorized('{"error":"Unauthorized","reason":"secret_missing","providedFingerprint":"empty"}')
    expect(fromConvex.answeredByConvex).toBe(true)
    expect(fromConvex.looksLikeProxyRejection).toBe(false)

    const fromProxy = unauthorized("<html>401 Authorization Required</html>", 'Basic realm="convex"')
    expect(fromProxy.answeredByConvex).toBe(false)
    expect(fromProxy.looksLikeProxyRejection).toBe(true)
  })

  it("still credits Convex for a deployment that predates the structured reasons", () => {
    const legacy = unauthorized('{"error":"Unauthorized"}')
    expect(legacy.answeredByConvex).toBe(true)
    expect(legacy.looksLikeProxyRejection).toBe(false)
    expect(legacy.isRetryable).toBe(false)
  })

  it("surfaces the sent fingerprint and a remediation without leaking the secret", () => {
    const error = unauthorized('{"error":"Unauthorized","reason":"secret_mismatch","providedFingerprint":"a1b2c3d4e5f6"}')
    expect(error.message).toContain("secret_mismatch")
    expect(error.message).toContain("a1b2c3d4e5f6")
    expect(error.remediation).toMatch(/does not match/i)
  })
})
