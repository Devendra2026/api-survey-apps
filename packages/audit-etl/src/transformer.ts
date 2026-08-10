import { createHash } from "node:crypto"
import type { LegacyAuditRecord, TargetAuditEvent } from "./schemas.js"
import { legacyAuditRecordSchema, targetAuditEventSchema } from "./schemas.js"

const REDACTED = "[REDACTED]"

/** Keys (case-insensitive) whose values are always redacted. */
const SENSITIVE_KEY_PATTERN =
  /^(password|passwd|secret|token|access_token|refresh_token|api_key|apikey|authorization|auth|credential|credentials|private_key|client_secret)$/i

/** Inline secret-ish substrings in strings. */
const INLINE_SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /(?:password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Deep-redact sensitive keys and inline secret patterns. */
export function redactPii(value: unknown): unknown {
  if (typeof value === "string") {
    let out = value
    for (const pattern of INLINE_SECRET_PATTERNS) {
      out = out.replace(pattern, REDACTED)
    }
    return out
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactPii(item))
  }
  if (!isPlainObject(value)) {
    return value
  }
  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = REDACTED
    } else {
      out[key] = redactPii(child)
    }
  }
  return out
}

function readStringField(meta: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = meta[key]
    if (typeof v === "string" && v.trim() !== "") return v
  }
  return null
}

function extractChanges(meta: Record<string, unknown>): {
  before: unknown | null
  after: unknown | null
} {
  const changes = meta.changes
  if (isPlainObject(changes)) {
    return {
      before: changes.before ?? changes.old ?? changes.from ?? null,
      after: changes.after ?? changes.new ?? changes.to ?? null,
    }
  }
  const before = meta.before ?? meta.oldValue ?? meta.old ?? null
  const after = meta.after ?? meta.newValue ?? meta.new ?? null
  if (before === null && after === null) {
    return { before: null, after: null }
  }
  return { before, after }
}

function stableChecksum(payload: unknown): string {
  const canonical = JSON.stringify(sortKeys(payload))
  return createHash("sha256").update(canonical).digest("hex")
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(sortKeys)
  const obj = value as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key])
  }
  return sorted
}

/**
 * Validate a legacy record, normalize timestamps to UTC ISO-8601, parse changes,
 * redact PII, and map to the flattened target schema.
 */
export function transformAuditRecord(raw: unknown): TargetAuditEvent {
  const legacy: LegacyAuditRecord = legacyAuditRecordSchema.parse(raw)
  const occurredAt = new Date(legacy._creationTime)
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error(`Invalid _creationTime: ${legacy._creationTime}`)
  }
  const occurredAtIso = occurredAt.toISOString()

  const metaRaw = legacy.metadata ?? null
  const metaObj = isPlainObject(metaRaw) ? (metaRaw as Record<string, unknown>) : {}
  const { before, after } = extractChanges(metaObj)

  const redactedMeta = metaRaw === null || metaRaw === undefined ? null : redactPii(metaRaw)
  const redactedBefore = before === null ? null : redactPii(before)
  const redactedAfter = after === null ? null : redactPii(after)

  const tenantId = isPlainObject(metaObj)
    ? readStringField(metaObj, ["tenantId", "tenant_id", "orgId", "organizationId"])
    : null
  const ip = isPlainObject(metaObj) ? readStringField(metaObj, ["ip", "ipAddress", "clientIp"]) : null
  const userAgent = isPlainObject(metaObj)
    ? readStringField(metaObj, ["userAgent", "user_agent", "ua"])
    : null

  const event: TargetAuditEvent = {
    eventId: legacy._id,
    occurredAt,
    occurredAtIso,
    actorId: legacy.actorId ?? null,
    action: legacy.action,
    resourceType: legacy.entity,
    resourceId: legacy.entityId ?? null,
    tenantId,
    changesBefore: redactedBefore,
    changesAfter: redactedAfter,
    ip,
    userAgent,
    metadata: redactedMeta,
    payloadChecksum: "",
  }

  event.payloadChecksum = stableChecksum({
    eventId: event.eventId,
    occurredAtIso: event.occurredAtIso,
    actorId: event.actorId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    tenantId: event.tenantId,
    changesBefore: event.changesBefore,
    changesAfter: event.changesAfter,
    ip: event.ip,
    userAgent: event.userAgent,
    metadata: event.metadata,
  })

  return targetAuditEventSchema.parse(event)
}

/** Safe transform: returns either the event or a DLQ-shaped failure. */
export function tryTransformAuditRecord(
  raw: unknown
): { ok: true; event: TargetAuditEvent } | { ok: false; error: string; stack: string | null } {
  try {
    return { ok: true, event: transformAuditRecord(raw) }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? (err.stack ?? null) : null,
    }
  }
}
