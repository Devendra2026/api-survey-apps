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
 *
 * Preserves actorName / actorEmail / actorClerkId in metadata (needed for Nest
 * Audit History → Clerk Users join). Top-level enrichment fields from Convex
 * extract are merged into metadata when missing.
 */
export function transformAuditRecord(raw: unknown): TargetAuditEvent {
  const legacy: LegacyAuditRecord = legacyAuditRecordSchema.parse(raw)
  const occurredAt = new Date(legacy._creationTime)
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error(`Invalid _creationTime: ${legacy._creationTime}`)
  }
  const occurredAtIso = occurredAt.toISOString()

  const metaRaw = legacy.metadata ?? null
  const metaObj = isPlainObject(metaRaw) ? { ...(metaRaw as Record<string, unknown>) } : {}

  // Merge Convex extract enrichment into metadata (do not overwrite existing snapshots).
  if (legacy.actorClerkId?.trim() && !readStringField(metaObj, ["actorClerkId", "actor_clerk_id"])) {
    metaObj.actorClerkId = legacy.actorClerkId.trim()
  }
  if (legacy.actorName?.trim() && !readStringField(metaObj, ["actorName", "actor_name"])) {
    metaObj.actorName = legacy.actorName.trim()
  }
  if (legacy.actorEmail?.trim() && !readStringField(metaObj, ["actorEmail", "actor_email"])) {
    metaObj.actorEmail = legacy.actorEmail.trim()
  }

  const { before, after } = extractChanges(metaObj)

  const hasMeta = Object.keys(metaObj).length > 0
  const redactedMeta = hasMeta ? redactPii(metaObj) : metaRaw === null || metaRaw === undefined ? null : redactPii(metaRaw)
  const redactedBefore = before === null ? null : redactPii(before)
  const redactedAfter = after === null ? null : redactPii(after)

  // Ensure actor identity keys survive redaction (they are not sensitive secrets).
  const metadataOut = ensureActorIdentityKeys(
    redactedMeta,
    metaObj.actorName,
    metaObj.actorEmail,
    metaObj.actorClerkId
  )

  const tenantId = readStringField(metaObj, ["tenantId", "tenant_id", "orgId", "organizationId"])
  const ip = readStringField(metaObj, ["ip", "ipAddress", "clientIp"])
  const userAgent = readStringField(metaObj, ["userAgent", "user_agent", "ua"])

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
    metadata: metadataOut,
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

function ensureActorIdentityKeys(
  redacted: unknown,
  actorName: unknown,
  actorEmail: unknown,
  actorClerkId: unknown
): unknown {
  if (redacted === null || redacted === undefined) {
    const out: Record<string, unknown> = {}
    if (typeof actorName === "string" && actorName.trim()) out.actorName = actorName.trim()
    if (typeof actorEmail === "string" && actorEmail.trim()) out.actorEmail = actorEmail.trim()
    if (typeof actorClerkId === "string" && actorClerkId.trim()) out.actorClerkId = actorClerkId.trim()
    return Object.keys(out).length > 0 ? out : null
  }
  if (!isPlainObject(redacted)) return redacted
  const out = { ...redacted }
  if (typeof actorName === "string" && actorName.trim() && !readStringField(out, ["actorName", "actor_name"])) {
    out.actorName = actorName.trim()
  }
  if (typeof actorEmail === "string" && actorEmail.trim() && !readStringField(out, ["actorEmail", "actor_email"])) {
    out.actorEmail = actorEmail.trim()
  }
  if (
    typeof actorClerkId === "string" &&
    actorClerkId.trim() &&
    !readStringField(out, ["actorClerkId", "actor_clerk_id"])
  ) {
    out.actorClerkId = actorClerkId.trim()
  }
  return out
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
