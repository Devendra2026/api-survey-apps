import { createHash } from "node:crypto"
import type { Prisma, PrismaClient } from "@workspace/database"
import { computeBackoffMs } from "@workspace/etl-core"
import type { DlqItem, TargetAuditEvent } from "../schemas.js"

/** Keep each interactive transaction well under Prisma's default limits. */
const UPSERT_CHUNK_SIZE = 100
const UPSERT_TX_TIMEOUT_MS = 60_000
const UPSERT_TX_MAX_WAIT_MS = 15_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined
  return value as Prisma.InputJsonValue
}

function toUpsertArgs(event: TargetAuditEvent) {
  return {
    where: { eventId: event.eventId },
    create: {
      eventId: event.eventId,
      occurredAt: event.occurredAt,
      actorId: event.actorId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      tenantId: event.tenantId,
      changesBefore: toJson(event.changesBefore),
      changesAfter: toJson(event.changesAfter),
      ip: event.ip,
      userAgent: event.userAgent,
      metadata: toJson(event.metadata),
      payloadChecksum: event.payloadChecksum,
    },
    update: {
      occurredAt: event.occurredAt,
      actorId: event.actorId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      tenantId: event.tenantId,
      changesBefore: toJson(event.changesBefore),
      changesAfter: toJson(event.changesAfter),
      ip: event.ip,
      userAgent: event.userAgent,
      metadata: toJson(event.metadata),
      payloadChecksum: event.payloadChecksum,
    },
  }
}

export class PostgresAuditLoader {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly options: { maxRetries?: number; retryBaseMs?: number; retryMaxMs?: number } = {}
  ) {}

  async upsertEvents(events: TargetAuditEvent[]): Promise<number> {
    if (events.length === 0) return 0
    return this.withRetry(async () => {
      for (let i = 0; i < events.length; i += UPSERT_CHUNK_SIZE) {
        const chunk = events.slice(i, i + UPSERT_CHUNK_SIZE)
        await this.prisma.$transaction(
          chunk.map((event) => this.prisma.auditEvent.upsert(toUpsertArgs(event))),
          { timeout: UPSERT_TX_TIMEOUT_MS, maxWait: UPSERT_TX_MAX_WAIT_MS }
        )
      }
      return events.length
    })
  }

  async appendDlq(items: DlqItem[]): Promise<number> {
    if (items.length === 0) return 0
    return this.withRetry(async () => {
      await this.prisma.auditEtlDlq.createMany({
        data: items.map((item) => ({
          payload: item.payload as Prisma.InputJsonValue,
          error: item.error,
          stack: item.stack,
        })),
      })
      return items.length
    })
  }

  async countAndChecksumInWindow(
    windowStartMs: number,
    windowEndMs: number
  ): Promise<{ count: number; checksum: string }> {
    const rows = await this.prisma.auditEvent.findMany({
      where: {
        occurredAt: {
          gte: new Date(windowStartMs),
          lt: new Date(windowEndMs),
        },
      },
      select: { eventId: true },
      orderBy: { eventId: "asc" },
    })
    const ids = rows.map((r) => r.eventId).sort()
    const checksum = createHash("sha256").update(ids.join("\n")).digest("hex")
    return { count: ids.length, checksum }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxRetries = this.options.maxRetries ?? 5
    const baseMs = this.options.retryBaseMs ?? 1_000
    const maxMs = this.options.retryMaxMs ?? 60_000
    let lastError: unknown
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        return await fn()
      } catch (err) {
        lastError = err
        if (attempt >= maxRetries) break
        await sleep(computeBackoffMs(attempt, baseMs, maxMs))
      }
    }
    throw lastError
  }
}
