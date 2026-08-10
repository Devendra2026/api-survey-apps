export const DEFAULT_AUDIT_ETL_BATCH_SIZE = 5_000
export const DEFAULT_AUDIT_ETL_PIPELINE_KEY = "convex-audit-logs"
export const DEFAULT_AUDIT_ETL_MAX_RETRIES = 5
export const DEFAULT_AUDIT_ETL_RETRY_BASE_MS = 1_000
export const DEFAULT_AUDIT_ETL_RETRY_MAX_MS = 60_000
export const DEFAULT_AUDIT_ETL_VERIFY_LOOKBACK_HOURS = 24

export interface AuditEtlConfig {
  convexSiteUrl: string
  etlSecret: string
  batchSize: number
  pipelineKey: string
  maxRetries: number
  retryBaseMs: number
  retryMaxMs: number
  verifyLookbackHours: number
}

function readInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : fallback
}

/** Load config from process.env (worker / API inject overrides as needed). */
export function loadAuditEtlConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<AuditEtlConfig> = {}
): AuditEtlConfig {
  const convexSiteUrl = (overrides.convexSiteUrl ?? env.CONVEX_SITE_URL ?? "").trim()
  const etlSecret = (overrides.etlSecret ?? env.ETL_CONVEX_SECRET ?? env.ETL_SECRET ?? "").trim()

  return {
    convexSiteUrl,
    etlSecret,
    batchSize: Math.min(
      5_000,
      Math.max(
        1,
        overrides.batchSize ?? readInt(env.AUDIT_ETL_BATCH_SIZE, DEFAULT_AUDIT_ETL_BATCH_SIZE)
      )
    ),
    pipelineKey: overrides.pipelineKey ?? env.AUDIT_ETL_PIPELINE_KEY?.trim() ?? DEFAULT_AUDIT_ETL_PIPELINE_KEY,
    maxRetries: overrides.maxRetries ?? readInt(env.AUDIT_ETL_MAX_RETRIES, DEFAULT_AUDIT_ETL_MAX_RETRIES),
    retryBaseMs: overrides.retryBaseMs ?? readInt(env.AUDIT_ETL_RETRY_BASE_MS, DEFAULT_AUDIT_ETL_RETRY_BASE_MS),
    retryMaxMs: overrides.retryMaxMs ?? readInt(env.AUDIT_ETL_RETRY_MAX_MS, DEFAULT_AUDIT_ETL_RETRY_MAX_MS),
    verifyLookbackHours:
      overrides.verifyLookbackHours ??
      readInt(env.AUDIT_ETL_VERIFY_LOOKBACK_HOURS, DEFAULT_AUDIT_ETL_VERIFY_LOOKBACK_HOURS),
  }
}

export function assertAuditEtlConfigured(config: AuditEtlConfig): void {
  if (!config.convexSiteUrl) {
    throw new Error("CONVEX_SITE_URL is required for audit ETL")
  }
  if (!config.etlSecret) {
    throw new Error("ETL_CONVEX_SECRET (or ETL_SECRET) is required for audit ETL")
  }
}
