import { describe, expect, it } from "@jest/globals"
import { redactPii, transformAuditRecord, tryTransformAuditRecord } from "./transformer.js"

describe("redactPii", () => {
  it("redacts sensitive keys deeply", () => {
    const out = redactPii({
      token: "abc",
      nested: { password: "secret", ok: "keep" },
      list: [{ api_key: "x" }],
    }) as Record<string, unknown>
    expect(out.token).toBe("[REDACTED]")
    expect((out.nested as Record<string, unknown>).password).toBe("[REDACTED]")
    expect((out.nested as Record<string, unknown>).ok).toBe("keep")
    expect((out.list as Array<Record<string, unknown>>)[0]?.api_key).toBe("[REDACTED]")
  })

  it("redacts bearer tokens in strings", () => {
    expect(redactPii("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.xx")).toContain("[REDACTED]")
  })
})

describe("transformAuditRecord", () => {
  it("maps Convex fields and normalizes UTC ISO timestamp", () => {
    const event = transformAuditRecord({
      _id: "j57abc",
      _creationTime: Date.UTC(2026, 7, 10, 12, 0, 0),
      actorId: "user_1",
      action: "survey.submitted",
      entity: "survey",
      entityId: "sv_1",
      metadata: {
        tenantId: "t1",
        ip: "1.2.3.4",
        userAgent: "test-agent",
        changes: { before: { status: "draft" }, after: { status: "submitted" } },
        token: "should-redact",
      },
    })

    expect(event.eventId).toBe("j57abc")
    expect(event.occurredAtIso).toBe("2026-08-10T12:00:00.000Z")
    expect(event.actorId).toBe("user_1")
    expect(event.resourceType).toBe("survey")
    expect(event.resourceId).toBe("sv_1")
    expect(event.tenantId).toBe("t1")
    expect(event.ip).toBe("1.2.3.4")
    expect(event.changesBefore).toEqual({ status: "draft" })
    expect(event.changesAfter).toEqual({ status: "submitted" })
    expect((event.metadata as Record<string, unknown>).token).toBe("[REDACTED]")
    expect(event.payloadChecksum).toMatch(/^[a-f0-9]{64}$/)
  })

  it("is idempotent for checksum on same payload", () => {
    const raw = {
      _id: "id1",
      _creationTime: 1_700_000_000_000,
      action: "user.approved",
      entity: "user",
      entityId: "u1",
      metadata: { before: { a: 1 }, after: { a: 2 } },
    }
    const a = transformAuditRecord(raw)
    const b = transformAuditRecord(raw)
    expect(a.payloadChecksum).toBe(b.payloadChecksum)
  })

  it("sends malformed rows to DLQ shape without throwing", () => {
    const result = tryTransformAuditRecord({ _id: "x" })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0)
    }
  })
})
