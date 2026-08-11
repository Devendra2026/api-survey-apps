import { z } from "zod"

/** Raw Convex auditLogs row as returned by /etl/audit/list. */
export const legacyAuditRecordSchema = z.object({
  _id: z.string().min(1),
  _creationTime: z.number().finite().nonnegative(),
  actorId: z.string().nullable().optional(),
  action: z.string().min(1),
  entity: z.string().min(1),
  entityId: z.string().nullable().optional(),
  metadata: z.unknown().nullable().optional(),
  /** Enriched by Convex listAuditLogs for Nest User.clerkUserId join. */
  actorClerkId: z.string().nullable().optional(),
  actorName: z.string().nullable().optional(),
  actorEmail: z.string().nullable().optional(),
})

export type LegacyAuditRecord = z.infer<typeof legacyAuditRecordSchema>

/** Flattened target event for Postgres audit_events. */
export const targetAuditEventSchema = z.object({
  eventId: z.string().min(1),
  occurredAt: z.date(),
  occurredAtIso: z.string().datetime({ offset: true }),
  actorId: z.string().nullable(),
  action: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().nullable(),
  tenantId: z.string().nullable(),
  changesBefore: z.unknown().nullable(),
  changesAfter: z.unknown().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  metadata: z.unknown().nullable(),
  payloadChecksum: z.string().min(1),
})

export type TargetAuditEvent = z.infer<typeof targetAuditEventSchema>

export const dlqItemSchema = z.object({
  payload: z.unknown(),
  error: z.string().min(1),
  stack: z.string().nullable(),
  failedAt: z.string().datetime({ offset: true }),
})

export type DlqItem = z.infer<typeof dlqItemSchema>

export const cursorStateSchema = z.object({
  lastProcessedTimestamp: z.number().finite().nonnegative(),
  lastProcessedId: z.string(),
  version: z.number().int().nonnegative(),
})

export type CursorState = z.infer<typeof cursorStateSchema>

export const verifyWindowResultSchema = z.object({
  windowStartMs: z.number(),
  windowEndMs: z.number(),
  sourceCount: z.number().int().nonnegative(),
  targetCount: z.number().int().nonnegative(),
  sourceChecksum: z.string(),
  targetChecksum: z.string(),
  ok: z.boolean(),
})

export type VerifyWindowResult = z.infer<typeof verifyWindowResultSchema>
