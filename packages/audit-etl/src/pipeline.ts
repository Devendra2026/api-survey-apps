import type { PrismaClient } from "@workspace/database"
import type { AuditEtlConfig } from "./config.js"
import { assertAuditEtlConfigured } from "./config.js"
import { CursorManager } from "./cursor_manager.js"
import { ConvexAuditExtractor } from "./extract/convex-audit-extractor.js"
import { PostgresAuditLoader } from "./load/postgres-loader.js"
import { auditEtlLogger } from "./observability/logger.js"
import type { DlqItem, TargetAuditEvent } from "./schemas.js"
import { tryTransformAuditRecord } from "./transformer.js"

export interface PipelineBatchStats {
  fetched: number
  upserted: number
  dlq: number
  batchLatencyMs: number
  eventsPerSec: number
}

export interface PipelineRunResult {
  batches: number
  fetched: number
  upserted: number
  dlq: number
  exhausted: boolean
  cursor: { lastProcessedTimestamp: number; lastProcessedId: string; version: number }
}

export interface RunAuditEtlPipelineOptions {
  prisma: PrismaClient
  config: AuditEtlConfig
  /** Max batches per invocation (default unlimited until source exhausted). */
  maxBatches?: number
  extractor?: ConvexAuditExtractor
  loader?: PostgresAuditLoader
  cursorManager?: CursorManager
}

/**
 * Core ETL runner: extract → transform → load → advance cursor.
 * Streams by batch; never loads the full history into memory.
 */
export async function runAuditEtlPipeline(
  options: RunAuditEtlPipelineOptions
): Promise<PipelineRunResult> {
  assertAuditEtlConfigured(options.config)
  const { prisma, config } = options
  const extractor =
    options.extractor ??
    new ConvexAuditExtractor({
      siteUrl: config.convexSiteUrl,
      etlSecret: config.etlSecret,
      maxRetries: config.maxRetries,
      retryBaseMs: config.retryBaseMs,
      retryMaxMs: config.retryMaxMs,
    })
  const loader =
    options.loader ??
    new PostgresAuditLoader(prisma, {
      maxRetries: config.maxRetries,
      retryBaseMs: config.retryBaseMs,
      retryMaxMs: config.retryMaxMs,
    })
  const cursorManager = options.cursorManager ?? new CursorManager(prisma, config.pipelineKey)

  let cursor = await cursorManager.getOrCreate()
  let batches = 0
  let fetched = 0
  let upserted = 0
  let dlq = 0
  let exhausted = false
  const maxBatches = options.maxBatches ?? Number.POSITIVE_INFINITY

  const stream = extractor.streamPages({
    lastCreationTime: cursor.lastProcessedTimestamp,
    lastId: cursor.lastProcessedId,
    limit: config.batchSize,
  })

  for await (const page of stream) {
    if (batches >= maxBatches) break
    const started = Date.now()
    const events: TargetAuditEvent[] = []
    const dlqItems: DlqItem[] = []

    for (const raw of page.records) {
      const result = tryTransformAuditRecord(raw)
      if (result.ok) {
        events.push(result.event)
      } else {
        dlqItems.push({
          payload: raw,
          error: result.error,
          stack: result.stack,
          failedAt: new Date().toISOString(),
        })
      }
    }

    // Load good rows first so a failed upsert does not leave orphan DLQ rows on retry.
    await loader.upsertEvents(events)
    await loader.appendDlq(dlqItems)

    if (page.nextCreationTime !== null && page.nextId !== null && page.records.length > 0) {
      cursor = await cursorManager.advance({
        expectedVersion: cursor.version,
        lastProcessedTimestamp: page.nextCreationTime,
        lastProcessedId: page.nextId,
      })
    }

    const batchLatencyMs = Date.now() - started
    const batchFetched = page.records.length
    const eventsPerSec = batchLatencyMs > 0 ? (batchFetched * 1000) / batchLatencyMs : batchFetched
    const failureRate = batchFetched > 0 ? dlqItems.length / batchFetched : 0

    auditEtlLogger.info({
      msg: "audit_etl_batch",
      fetched: batchFetched,
      upserted: events.length,
      dlqCount: dlqItems.length,
      batchLatencyMs,
      eventsPerSec: Math.round(eventsPerSec * 100) / 100,
      failureRate: Math.round(failureRate * 10_000) / 10_000,
      isDone: page.isDone,
      cursorTimestamp: cursor.lastProcessedTimestamp,
      cursorId: cursor.lastProcessedId,
    })

    batches += 1
    fetched += batchFetched
    upserted += events.length
    dlq += dlqItems.length
    exhausted = page.isDone || page.records.length === 0

    if (exhausted) break
  }

  auditEtlLogger.info({
    msg: "audit_etl_run_complete",
    batches,
    fetched,
    upserted,
    dlq,
    exhausted,
    cursorTimestamp: cursor.lastProcessedTimestamp,
    cursorId: cursor.lastProcessedId,
  })

  return {
    batches,
    fetched,
    upserted,
    dlq,
    exhausted,
    cursor: {
      lastProcessedTimestamp: cursor.lastProcessedTimestamp,
      lastProcessedId: cursor.lastProcessedId,
      version: cursor.version,
    },
  }
}
