import type { PrismaClient } from "@workspace/database"
import type { AuditEtlConfig } from "./config.js"
import { assertAuditEtlConfigured } from "./config.js"
import { ConvexAuditExtractor } from "./extract/convex-audit-extractor.js"
import { PostgresAuditLoader } from "./load/postgres-loader.js"
import { auditEtlLogger } from "./observability/logger.js"
import type { VerifyWindowResult } from "./schemas.js"

const HOUR_MS = 60 * 60 * 1000

export function floorToUtcHour(ms: number): number {
  return Math.floor(ms / HOUR_MS) * HOUR_MS
}

export function listHourWindows(lookbackHours: number, nowMs: number): Array<{
  windowStartMs: number
  windowEndMs: number
}> {
  const endHour = floorToUtcHour(nowMs)
  const windows: Array<{ windowStartMs: number; windowEndMs: number }> = []
  for (let i = lookbackHours; i >= 1; i -= 1) {
    const windowEndMs = endHour - (i - 1) * HOUR_MS
    const windowStartMs = windowEndMs - HOUR_MS
    windows.push({ windowStartMs, windowEndMs })
  }
  return windows
}

export interface VerifyMigrationOptions {
  prisma: PrismaClient
  config: AuditEtlConfig
  /** Wall-clock ms for windowing (passed from caller — never Date.now inside a Convex query). */
  nowMs: number
  lookbackHours?: number
  extractor?: ConvexAuditExtractor
  loader?: PostgresAuditLoader
}

/**
 * Compare source vs target counts and SHA-256 of sorted event ids per UTC hour bucket.
 */
export async function verifyMigration(options: VerifyMigrationOptions): Promise<{
  windows: VerifyWindowResult[]
  ok: boolean
  discrepancies: VerifyWindowResult[]
}> {
  assertAuditEtlConfigured(options.config)
  const lookback = options.lookbackHours ?? options.config.verifyLookbackHours
  const extractor =
    options.extractor ??
    new ConvexAuditExtractor({
      siteUrl: options.config.convexSiteUrl,
      etlSecret: options.config.etlSecret,
      maxRetries: options.config.maxRetries,
      retryBaseMs: options.config.retryBaseMs,
      retryMaxMs: options.config.retryMaxMs,
    })
  const loader =
    options.loader ??
    new PostgresAuditLoader(options.prisma, {
      maxRetries: options.config.maxRetries,
      retryBaseMs: options.config.retryBaseMs,
      retryMaxMs: options.config.retryMaxMs,
    })

  const windows: VerifyWindowResult[] = []
  for (const { windowStartMs, windowEndMs } of listHourWindows(lookback, options.nowMs)) {
    const source = await extractor.verifyWindow({ windowStartMs, windowEndMs })
    const target = await loader.countAndChecksumInWindow(windowStartMs, windowEndMs)
    const result: VerifyWindowResult = {
      windowStartMs,
      windowEndMs,
      sourceCount: source.count,
      targetCount: target.count,
      sourceChecksum: source.checksum,
      targetChecksum: target.checksum,
      ok: source.count === target.count && source.checksum === target.checksum,
    }
    windows.push(result)
    if (!result.ok) {
      auditEtlLogger.warn({
        msg: "audit_etl_verify_mismatch",
        windowStartMs,
        windowEndMs,
        sourceCount: result.sourceCount,
        targetCount: result.targetCount,
        sourceChecksum: result.sourceChecksum,
        targetChecksum: result.targetChecksum,
      })
    } else {
      auditEtlLogger.info({
        msg: "audit_etl_verify_ok",
        windowStartMs,
        windowEndMs,
        count: result.sourceCount,
      })
    }
  }

  const discrepancies = windows.filter((w) => !w.ok)
  const ok = discrepancies.length === 0
  auditEtlLogger.info({
    msg: "audit_etl_verify_complete",
    windows: windows.length,
    discrepancies: discrepancies.length,
    ok,
  })
  return { windows, ok, discrepancies }
}
